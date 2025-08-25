/*
  SerialPort.list() [
    {
      path: 'COM14',
      manufacturer: 'FTDI',
      serialNumber: 'AI069HNC',
      pnpId: 'FTDIBUS\\VID_0403+PID_6001+AI069HNCA\\0000',
      locationId: undefined,
      friendlyName: 'USB Serial Port (COM14)',
      vendorId: '0403',
      productId: '6001'
    },
    {
      path: 'COM7',
      manufacturer: 'wch.cn',
      serialNumber: '5&79927EA&0&9',
      pnpId: 'USB\\VID_1A86&PID_7523\\5&79927EA&0&9',
      locationId: 'Port_#0009.Hub_#0001',
      friendlyName: 'USB-SERIAL CH340 (COM7)',
      vendorId: '1A86',
      productId: '7523'
    }
  ]

  bonjour.find() {
    addresses: [ '192.168.3.119' ],
    name: 'rongbuk-6767b0',
    fqdn: 'rongbuk-6767b0._sonic._tcp.local',
    host: 'rongbuk-6767b0.local',
    referer: { address: '192.168.3.119', family: 'IPv4', port: 5353, size: 122 },
    port: 7332,
    type: 'sonic',
    protocol: 'tcp',
    subtypes: [],
    rawTxt: <Buffer 00>,
    txt: {}
  }
 */

/**
 * The Rongbuk device does not have built-in id, for display and establish a connection
 *
 * In serial case, friendly name and path (com port) suffices.
 * In network case, name and addresses sufficies.
 */

export type ConnectionState = 'CONNECTED' | 'DISCONNECTED';

export interface RongbukDevice {
  connectionState: ConnectionState; // CONNECTED, DISCONNECTED
  name: string; // friendly name for serial case, name for network case
  location: string | string[]; // string for comport path, string[] for addreses.
}

export interface ConnectionRequest {
  deviceId: string;
  type: 'serial' | 'network';
  serialData?: SerialDevice;
  networkData?: NetworkDevice;
}

// Minimal IPC channels
export interface IPCChannels {
  'select-device-candidate': RongbukDevice;
  'select-device': RongbukDevice;
}
