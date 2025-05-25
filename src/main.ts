import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

// Simple IPC-based logging
const sendLogToRenderer = (message: string) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('main-log', message);
  }
};

const createWindow = () => {
  sendLogToRenderer('🚀 Creating main window...');
  
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  mainWindow.loadFile('src/index.html');

  sendLogToRenderer('📡 Setting up Web Serial API handlers...');

  // Handle Web Serial API - based on your working configuration
  mainWindow.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
    sendLogToRenderer('🔥 select-serial-port event fired!');
    sendLogToRenderer(`📋 portList length: ${portList ? portList.length : 'null'}`);
    sendLogToRenderer(`📋 portList details: ${JSON.stringify(portList)}`);

    event.preventDefault();
    if (portList && portList.length > 0) {
      sendLogToRenderer(`✅ Auto-selecting first port: ${JSON.stringify(portList[0])}`);
      callback(portList[0].portId);
    } else {
      sendLogToRenderer('❌ No ports available');
      callback(''); // Could not find any matching devices
    }
  });

  // Add listeners to handle ports being added or removed
  mainWindow.webContents.session.on('serial-port-added', (event, port) => {
    sendLogToRenderer(`🔌 serial-port-added FIRED WITH: ${JSON.stringify(port)}`);
  });

  mainWindow.webContents.session.on('serial-port-removed', (event, port) => {
    sendLogToRenderer(`🔌 serial-port-removed FIRED WITH: ${JSON.stringify(port)}`);
  });

  /**
   * This handler allows (only) navigator.serial.requestPorts() to access host serial devices
   */
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    sendLogToRenderer(`🔐 setPermissionCheckHandler called`);
    sendLogToRenderer(`🔐 permission: ${permission}`);
    sendLogToRenderer(`🔐 securityOrigin: ${details.securityOrigin}`);

    const fileOrigin = (details.securityOrigin === 'file:///');
    const localhostOrigin = (details.securityOrigin.startsWith('http://localhost:')); // for webpack dev server
    
    if (permission === 'serial' && (fileOrigin || localhostOrigin)) {
      sendLogToRenderer('✅ Serial permission granted');
      return true;
    }

    sendLogToRenderer('❌ Permission denied');
    return false;
  });

  /**
   * This handler allows (only) navigator.serial.getPorts() to access host serial devices
   */
  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    sendLogToRenderer(`📱 setDevicePermissionHandler called`);
    sendLogToRenderer(`📱 deviceType: ${details.deviceType}`);
    sendLogToRenderer(`📱 origin: ${details.origin}`);
    sendLogToRenderer(`📱 device: ${JSON.stringify(details.device)}`);

    const fileOrigin = (details.origin === 'file://');
    const localhostOrigin = (details.origin.startsWith('http://localhost:'));
    if (details.deviceType === 'serial' && (fileOrigin || localhostOrigin)) {
      sendLogToRenderer('✅ Device permission granted');
      return true;
    }

    sendLogToRenderer('❌ Device permission denied');
    return false;
  });

  mainWindow.on('ready-to-show', () => {
    sendLogToRenderer('📄 ready-to-show - Web Serial API should be available');
  });

  mainWindow.setMenuBarVisibility(false);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  sendLogToRenderer('✅ Web Serial API handlers configured successfully');
};

// Set up IPC handler for testing
ipcMain.on('test-main-process', (event) => {
  sendLogToRenderer('🧪 Main process IPC test received!');
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  sendLogToRenderer('⚡ Electron app ready');
  
  createWindow();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  sendLogToRenderer('🪟 All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});