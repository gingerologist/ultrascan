// Minimal preload script - just log that it's loaded
// console.log('Preload script loaded - Web Serial API should be available');

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Device discovery types
interface DeviceInfo {
  addresses: string[];
  name: string;
  fqdn: string;
  host: string;
  referer: { address: string; family: string; port: number; size: number };
  port: number;
  type: string;
  protocol: string;
  subtypes: string[];
  rawTxt: Buffer;
  txt: Record<string, any>;
  connected: boolean;
}

// Serial communication types
interface SerialData {
  data: string;
  timestamp: number;
}

// Main window types
interface AppSettings {
  theme: 'light' | 'dark';
  autoConnect: boolean;
  defaultPort: number;
}

interface ElectronAPI {
  // Device Discovery (for modal windows)
  deviceDiscovery: {
    startScan: () => void;
    selectDevice: (device: DeviceInfo) => void;
    cancelSelection: () => void;
    onDeviceDiscovered: (callback: (device: DeviceInfo) => void) => () => void;
    onScanComplete: (callback: () => void) => () => void;
  };

  // TCP Communication (for main window)
  tcp: {
    connect: (host: string, port: number) => Promise<boolean>;
    disconnect: () => void;
    send: (data: string) => void;
    onData: (callback: (data: string) => void) => () => void;
    onConnectionStatus: (callback: (connected: boolean) => void) => () => void;
  };

  // Serial Communication (legacy support)
  serial: {
    send: (data: string) => void;
    onData: (callback: (data: SerialData) => void) => () => void;
  };

  // App Management (for main window)
  app: {
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: AppSettings) => Promise<void>;
    openDeviceModal: () => Promise<DeviceInfo | null>;
    quit: () => void;
  };

  // Window Management
  window: {
    close: () => void;
    minimize: () => void;
    maximize: () => void;
    onFocus: (callback: () => void) => () => void;
    onBlur: (callback: () => void) => () => void;
  };

  // Global messaging (for any window)
  messaging: {
    send: (channel: string, data: any) => void;
    on: (channel: string, callback: (data: any) => void) => () => void;
    invoke: (channel: string, data?: any) => Promise<any>;
  };
}

// Helper function for creating listeners
function createListener<T>(
  channel: string,
  callback: (data: T) => void
): () => void {
  const listener = (_event: IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Device Discovery API
  deviceDiscovery: {
    startScan: () => ipcRenderer.send('start-device-scan'),
    selectDevice: (device) => ipcRenderer.send('device-selected', device),
    cancelSelection: () => ipcRenderer.send('device-selection-cancelled'),
    onDeviceDiscovered: (callback) => createListener('device-discovered', callback),
    onScanComplete: (callback) => createListener('scan-complete', callback),
  },

  // TCP Communication API
  tcp: {
    connect: (host, port) => ipcRenderer.invoke('tcp-connect', { host, port }),
    disconnect: () => ipcRenderer.send('tcp-disconnect'),
    send: (data) => ipcRenderer.send('tcp-send', data),
    onData: (callback) => createListener('tcp-data', callback),
    onConnectionStatus: (callback) => createListener('tcp-status', callback),
  },

  // Serial Communication API (legacy)
  serial: {
    send: (data) => ipcRenderer.send('serial-send', data),
    onData: (callback) => createListener('serial-data', callback),
  },

  // App Management API
  app: {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    openDeviceModal: () => ipcRenderer.invoke('open-device-modal'),
    quit: () => ipcRenderer.send('app-quit'),
  },

  // Window Management API
  window: {
    close: () => ipcRenderer.send('window-close'),
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    onFocus: (callback) => createListener('window-focus', callback),
    onBlur: (callback) => createListener('window-blur', callback),
  },

  // Global Messaging API
  messaging: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => createListener(channel, callback),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  },
} as ElectronAPI);