import {
  app,
  BrowserWindow,
  Menu,
  MenuItem,
  ipcMain,
  IpcMainEvent,
} from 'electron';

import * as net from 'net';

import type {
  ConnectionRequest,
  ConnectionState,
  RongbukDevice,
} from './types/devices';

import SelectDevice from './select-device';

import {
  UltrasonicDataParser,
  MetadataPacket,
  DataPacket,
  ScanData,
} from './parser';

// Connection descriptor (metadata)
interface ConnectionDescriptor {
  id: string;
  name: string;
  type: 'serial' | 'network';
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  connectedAt?: Date;
  lastError?: string;
}

// The actual communication streams
interface ConnectionStreams {
  network?: net.Socket; // TCP socket for network devices
  serial?: SerialPort; // SerialPort instance for serial devices
}

// Combined connection state
interface ActiveConnection {
  descriptor: ConnectionDescriptor;
  streams: ConnectionStreams;
}

// Global connection state
let currentConnection: ActiveConnection | null = null;

// Connect to network device
// async function connectToNetworkDevice(
//   networkData: NetworkDevice
// ): Promise<void> {
//   try {
//     // Create connection descriptor
//     const descriptor: ConnectionDescriptor = {
//       id: `network-${networkData.host}-${networkData.port}`,
//       name: networkData.name,
//       type: 'network',
//       status: 'connecting',
//     };

//     // Create TCP socket
//     const socket = new net.Socket();

//     // Set up the connection object
//     currentConnection = {
//       descriptor,
//       streams: { network: socket },
//     };

//     // Connect with promise wrapper
//     await new Promise<void>((resolve, reject) => {
//       socket.connect(networkData.port, networkData.host, () => {
//         console.log(`Connected to ${networkData.host}:${networkData.port}`);

//         // Update connection status
//         currentConnection!.descriptor.status = 'connected';
//         currentConnection!.descriptor.connectedAt = new Date();

//         resolve();
//       });

//       socket.on('error', error => {
//         currentConnection!.descriptor.status = 'error';
//         currentConnection!.descriptor.lastError = error.message;
//         reject(error);
//       });

//       socket.on('close', () => {
//         console.log('Network connection closed');
//         currentConnection = null;
//       });

//       socket.on('data', data => {
//         // console.log('Received data:', data.toString());
//         console.log(`received ${data.length} bytes`);
//         // Handle incoming data
//         // TODO: handleIncomingData(data);
//       });
//     });
//   } catch (error) {
//     console.error('Failed to connect to network device:', error);
//     currentConnection = null;
//     throw error;
//   }
// }

// Connect to serial device
// async function connectToSerialDevice(serialData: SerialDevice): Promise<void> {
//   try {
//     // Create connection descriptor
//     const descriptor: ConnectionDescriptor = {
//       id: `serial-${serialData.path}`,
//       name: serialData.path,
//       type: 'serial',
//       status: 'connecting',
//     };

//     // Create SerialPort instance
//     const port = new SerialPort({
//       path: serialData.path,
//       baudRate: 9600, // Adjust as needed
//       autoOpen: false,
//     });

//     // Set up the connection object
//     currentConnection = {
//       descriptor,
//       streams: { serial: port },
//     };

//     // Open the port
//     await new Promise<void>((resolve, reject) => {
//       port.open(error => {
//         if (error) {
//           currentConnection!.descriptor.status = 'error';
//           currentConnection!.descriptor.lastError = error.message;
//           reject(error);
//         } else {
//           currentConnection!.descriptor.status = 'connected';
//           currentConnection!.descriptor.connectedAt = new Date();
//           resolve();
//         }
//       });
//     });

//     // Set up data handlers
//     port.on('data', data => {
//       console.log('Serial data received:', data.toString());
//       handleIncomingData(data);
//     });

//     port.on('close', () => {
//       console.log('Serial port closed');
//       currentConnection = null;
//     });

//     port.on('error', error => {
//       console.error('Serial port error:', error);
//       currentConnection!.descriptor.status = 'error';
//       currentConnection!.descriptor.lastError = error.message;
//     });
//   } catch (error) {
//     console.error('Failed to connect to serial device:', error);
//     currentConnection = null;
//     throw error;
//   }
// }

// Send data through current connection
// function sendData(data: string | Buffer): boolean {
//   if (
//     !currentConnection ||
//     currentConnection.descriptor.status !== 'connected'
//   ) {
//     console.error('No active connection');
//     return false;
//   }

//   try {
//     if (currentConnection.streams.network) {
//       currentConnection.streams.network.write(data);
//       return true;
//     } else if (currentConnection.streams.serial) {
//       currentConnection.streams.serial.write(data);
//       return true;
//     }
//   } catch (error) {
//     console.error('Failed to send data:', error);
//     return false;
//   }

//   return false;
// }

// Handle incoming data (unified for both connection types)
function handleIncomingData(data: Buffer) {
  // Process the data regardless of source
  console.log('Processing data:', data.toString());

  // Send to main window if needed
  mainWindow?.webContents.send('device-data', data.toString());
}

// Disconnect current device
function disconnectCurrentDevice(): void {
  if (!currentConnection) return;

  try {
    if (currentConnection.streams.network) {
      currentConnection.streams.network.destroy();
    } else if (currentConnection.streams.serial) {
      currentConnection.streams.serial.close();
    }
  } catch (error) {
    console.error('Error during disconnect:', error);
  }

  currentConnection = null;
}

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).

/**
 * @ignore
 */
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

let connectedSerialDevice = null;
let connectedNetworkDevice = null;

// Generate unique ID for devices
// function generateDeviceId(
//   device: SerialDevice | NetworkDevice,
//   type: 'serial' | 'network'
// ): string {
//   if (type === 'serial') {
//     const serial = device as SerialDevice;
//     return `serial-${serial.path}`;
//   } else {
//     const network = device as NetworkDevice;
//     return `network-${network.host}-${network.port}`;
//   }
// }

// Convert devices to selectable format
// function createSelectableDevice(
//   device: SerialDevice | NetworkDevice,
//   type: 'serial' | 'network'
// ): SelectableDevice {
//   if (type === 'serial') {
//     const serial = device as SerialDevice;
//     return {
//       id: generateDeviceId(device, type),
//       name: serial.path,
//       type: 'serial',
//       description: serial.manufacturer || 'Unknown manufacturer',
//       serialData: serial,
//     };
//   } else {
//     const network = device as NetworkDevice;
//     return {
//       id: generateDeviceId(device, type),
//       name: network.name,
//       type: 'network',
//       description: `${network.host}:${network.port}`,
//       networkData: network,
//     };
//   }
// }

const updateMenuSelectDevice = (enabled: boolean): void => {
  const menu = Menu.getApplicationMenu();
  if (menu) {
    const item = menu.getMenuItemById('SelectDevice');
    if (item) {
      item.enabled = enabled;
    }
  }
};

/**
 * create main window, with extra menucommand
 */
const createMainWindow = (): void => {
  const insertMenuCommand = (): void => {
    const currentMenu = Menu.getApplicationMenu();
    if (currentMenu) {
      const fileMenu = currentMenu.items.find(item => item.label === 'File');

      if (fileMenu) {
        fileMenu.submenu?.insert(0, new MenuItem({ type: 'separator' }));
        fileMenu.submenu?.insert(
          0,
          new MenuItem({
            id: 'selectDevice',
            label: 'Select Device',
            enabled: true,
            click: () => {
              if (mainWindow !== null) {
                SelectDevice(mainWindow, (err, device) => {
                  console.log(err || device);
                });
              }
            },
          })
        );

        Menu.setApplicationMenu(currentMenu);
      }
    }
  };

  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  insertMenuCommand();
  // mainWindow.webContents.openDevTools();

  // don't delete the following settings, though not used now.
  // Handle Web Serial API
  mainWindow.webContents.session.on(
    'select-serial-port',
    (event, portList, webContents, callback) => {
      console.log('Available ports:', portList);

      if (portList && portList.length > 0) {
        callback(portList[0].portId);
      } else {
        callback('');
      }
    }
  );

  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) => {
      return permission === 'serial';
    }
  );

  mainWindow.webContents.session.setDevicePermissionHandler(details => {
    return details.deviceType === 'serial';
  });
};

/**
 * The following two functions are dealing with
 * the difference among platforms. On Linux and Windows, 'ready' is used,
 * while on macOS, 'activate' is used.
 */
app.on('ready', createMainWindow);
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

/**
 * exit
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
// ipcMain.on('connect-to-device', async (event, request: ConnectionRequest) => {
//   console.log('Connection request:', request);

//   // Close the devices window immediately
//   if (devicesWindow) {
//     devicesWindow.close();
//     devicesWindow = null;
//   }

//   // Attempt connection
//   try {
//     if (request.type === 'network' && request.networkData) {
//       await connectToNetworkDevice(request.networkData);
//     } else if (request.type === 'serial' && request.serialData) {
//       await connectToSerialDevice(request.serialData);
//     }

//     // Notify main window of successful connection
//     mainWindow?.webContents.send('device-connected', {
//       type: currentConnection!.descriptor.type,
//       name: currentConnection!.descriptor.name,
//     });
//   } catch (error) {
//     // Show error dialog
//     const { dialog } = require('electron');
//     dialog.showErrorBox(
//       'Connection Failed',
//       `Failed to connect to device: ${error.message}`
//     );
//   }
// });

// ipcMain.on('connect-to-device', async (event, request: ConnectionRequest) => {
//   console.log('Connection request:', request);

//   // Close the devices window immediately
//   if (devicesWindow) {
//     devicesWindow.close();
//     devicesWindow = null;
//   }

//   // Handle connection logic here...
// });
