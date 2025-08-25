// src/types/devices.d.ts
export interface SerialDevice {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

export interface NetworkDevice {
  name: string;
  type: string;
  protocol: string;
  host: string;
  port: number;
  txt?: Record<string, string>;
  addresses?: string[];
}

export interface SelectableDevice {
  id: string;
  name: string;
  type: 'serial' | 'network';
  description: string;
  serialData?: SerialDevice;
  networkData?: NetworkDevice;
}

export interface ConnectionRequest {
  deviceId: string;
  type: 'serial' | 'network';
  serialData?: SerialDevice;
  networkData?: NetworkDevice;
}

// Minimal IPC channels
export interface IPCChannels {
  'device-available': SelectableDevice;
  'connect-to-device': ConnectionRequest;
}