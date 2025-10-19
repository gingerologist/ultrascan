// Add this to your main Electron process file (usually main.ts or main.js)

import { BrowserWindow, Menu, MenuItem } from 'electron';
import * as path from 'path';

// Vite构建时的入口文件路径
const TESTING_WINDOW_ENTRY = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000/testing.html' 
  : path.join(__dirname, '../renderer/testing.html');
const TESTING_WINDOW_PRELOAD_ENTRY = path.join(__dirname, '../preload/preload.cjs');

let testingWindow: BrowserWindow | null = null;

// Function to create the testing window
function createTestingWindow() {
  // Prevent multiple instances
  if (testingWindow && !testingWindow.isDestroyed()) {
    testingWindow.focus();
    return;
  }

  testingWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    title: 'Testing',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // enableRemoteModule: false,
      // preload: path.join(__dirname, 'preload.js'), // Optional: if you need IPC
      preload: TESTING_WINDOW_PRELOAD_ENTRY,
    },
    show: false, // Don't show until ready
  });

  // Load the testing HTML file
  // if (process.env.NODE_ENV === 'development') {
  //   // In development, you might serve from webpack dev server
  //   testingWindow.loadURL('http://localhost:3000/testing.html');
  //   testingWindow.webContents.openDevTools();
  // } else {
  //   // In production, load from the built files
  //   testingWindow.loadFile(path.join(__dirname, '../dist/testing.html'));
  // }

  testingWindow.setMenu(null);

  testingWindow.loadURL(TESTING_WINDOW_ENTRY);

  // Show window when ready to prevent visual flash
  testingWindow.once('ready-to-show', () => {
    testingWindow?.show();
  });

  // Clean up when window is closed
  testingWindow.on('closed', () => {
    testingWindow = null;
  });

  // Optional: Set up window menu
  // const template: Electron.MenuItemConstructorOptions[] = [
  //   {
  //     label: 'File',
  //     submenu: [
  //       {
  //         label: 'Close',
  //         accelerator: 'CmdOrCtrl+W',
  //         click: () => {
  //           testingWindow?.close();
  //         },
  //       },
  //     ],
  //   },
  //   {
  //     label: 'Edit',
  //     submenu: [{ role: 'copy' }, { role: 'paste' }, { role: 'selectall' }],
  //   },
  //   {
  //     label: 'View',
  //     submenu: [
  //       { role: 'reload' },
  //       { role: 'forceReload' },
  //       { role: 'toggleDevTools' },
  //       { type: 'separator' },
  //       { role: 'resetZoom' },
  //       { role: 'zoomIn' },
  //       { role: 'zoomOut' },
  //     ],
  //   },
  // ];

  // const menu = Menu.buildFromTemplate(template);
  // testingWindow.setMenu(menu);

  return testingWindow;
}

// Function to add to your main window menu or call programmatically
function openTestingWindow() {
  createTestingWindow();
}

// Example: Add to your main window menu
function addTestingMenuToMainWindow(mainWindow: BrowserWindow) {
  const currentMenu = Menu.getApplicationMenu();

  // Add a "Tools" menu with "Open Testing Window" option
  const toolsMenu = new MenuItem({
    label: 'Tools',
    submenu: [
      {
        label: 'Open Testing Window',
        accelerator: 'CmdOrCtrl+T',
        click: () => {
          openTestingWindow();
        },
      },
    ],
  });

  // If you have an existing menu, you can modify it
  // Or create a simple menu structure
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Open Testing Window',
          accelerator: 'CmdOrCtrl+T',
          click: openTestingWindow,
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Export the functions you need
export { createTestingWindow, openTestingWindow, addTestingMenuToMainWindow };
