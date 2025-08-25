import { BrowserWindow, ipcMain, IpcMainEvent } from 'electron';

import { SerialPort } from 'serialport';
import * as Bonjour from 'bonjour';

import type {
  ConnectionRequest,
  ConnectionState,
  RongbukDevice,
} from './types/devices';

const bonjour = Bonjour.default({ interface: '0.0.0.0' }); // interface setting important!

declare const MODAL_WINDOW_WEBPACK_ENTRY: string;
declare const MODAL_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let devicesWindow: BrowserWindow | null = null;

const selectDeviceListener = (event: IpcMainEvent, ...args: any[]) => {
  // Handle the IPC message
  console.log('Received args:', args);

  // Close the devices window immediately
  if (devicesWindow) {
    devicesWindow.close();
    devicesWindow = null;
  }
};

/**
 * create devices window in insecure mode
 */
const SelectDevice = (
  parent: BrowserWindow,
  callback: SelectDeviceCallback
): void => {
  devicesWindow = new BrowserWindow({
    parent,
    modal: true,
    show: false,
    width: 500,
    height: 400,
    autoHideMenuBar: true,
    // @ts-ignore - menuBarVisible exists but missing from types
    menuBarVisible: false, // fake error, said Trump
    minimizable: false,
    maximizable: false,
    webPreferences: {
      // preload: MODAL_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  devicesWindow.loadURL(MODAL_WINDOW_WEBPACK_ENTRY);
  // devicesWindow.webContents.openDevTools();

  devicesWindow.once('ready-to-show', () => {
    devicesWindow.show();

    // Start Bonjour discovery
    // @ts-ignore - bonjour types incomplete
    const discover = bonjour.find({ type: 'sonic', port: 7332 }, service => {
      if (devicesWindow === null) return;

      console.log('bonjour.find()', service);
      const { name, addresses: location } = service;

      const device: RongbukDevice = {
        connectionState: 'DISCONNECTED',
        name,
        location,
      };
      devicesWindow?.webContents.send('select-device-candidate', device);
    });

    SerialPort.list()
      .then(ports => {
        if (devicesWindow === null) return;

        console.log('SerialPort.list()', ports);

        ports.forEach(port => {
          // @ts-ignore
          const device: RongbukDevice = {
            connectionState: 'DISCONNECTED',
            // @ts-ignore
            name: port.friendlyName || port.path,
            location: port.path,
          };

          // Send to devices window
          devicesWindow?.webContents.send('select-device-candidate', device);
        });
      })
      .catch(e => console.log('SerialPort.list()', e));
  });

  devicesWindow.on('closed', () => {
    devicesWindow = null;
    ipcMain.off('select-device', selectDeviceListener);
  });

  ipcMain.on('select-device', selectDeviceListener);
};

export type SelectDeviceCallback = (
  error: Error,
  device: RongbukDevice | null
) => void;

export default SelectDevice;
