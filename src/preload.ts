// Minimal preload script - just log that it's loaded
// console.log('Preload script loaded - Web Serial API should be available');

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

interface ElectronAPI {
  openModal: () => Promise<void>;
  submitModalData: (data: { content: string }) => Promise<{ success: boolean }>;
  onModalDataReceived: (callback: (data: { content: string; timestamp: string }) => void) => () => void;
  onGlobalMessage: (callback: (message: string) => void) => () => void;
}


contextBridge.exposeInMainWorld('electronAPI', {
  openModal: () => ipcRenderer.invoke('open-modal'),
  submitModalData: (data) => ipcRenderer.invoke('submit-modal-data', data),
  onModalDataReceived: (callback) => {
    const listener = (_event: IpcRendererEvent, data: { content: string; timestamp: string }) => {
      callback(data);
    };
    ipcRenderer.on('modal-data-received', listener);
    return () => ipcRenderer.removeListener('modal-data-received', listener);
  },


  onGlobalMessage: (callback) => {
    const listener = (_event: IpcRendererEvent, message: string) => {
      callback(message);
    };
    ipcRenderer.on('global-message', listener);
    return () => ipcRenderer.removeListener('global-message', listener);
  }
} as ElectronAPI);