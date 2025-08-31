import { SerialPort } from 'serialport';
import * as Bonjour from 'bonjour';

import type { RongbukDevice } from './types/devices';

const bonjour = Bonjour.default({ interface: '0.0.0.0' }); // interface setting important!

export default (callback: (device: RongbukDevice) => void): void => {
  bonjour.find(
    {
      type: 'sonic',
      // @ts-ignore
      port: 7332,
    },
    service => {
      console.log('bonjour.find()', service);
      const { name, addresses: location } = service;

      const device: RongbukDevice = {
        connectionState: 'DISCONNECTED',
        name,
        location,
      };
      callback(device);
    }
  );

  SerialPort.list()
    .then(ports => {
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
        callback(device);
      });
    })
    .catch(e => console.log('[discover-devices] SerialPort.list()', e));
};
