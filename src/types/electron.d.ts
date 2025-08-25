// declare global {
//   interface Window {
//     electron?: {
//       closeWindow: () => void;
//     };
//   }
// }

// export { };

import type { IPCChannels } from './devices';

interface ElectronAPI {
  refreshDevices: () => void;
  connectDevice: (deviceId: string, type: 'serial' | 'network') => void;
  disconnectDevice: (deviceId: string) => void;
  closeWindow: () => void;

  onSerialDeviceFound: (callback: (device: IPCChannels['serial-device-found']) => void) => () => void;
  onNetworkDeviceFound: (callback: (device: IPCChannels['network-device-found']) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export { }