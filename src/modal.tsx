import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { SelectableDevice, ConnectionRequest } from './types/devices';

const { ipcRenderer } = window.require('electron');

const ModalApp: React.FC = () => {
  const [devices, setDevices] = useState<SelectableDevice[]>([]);

  useEffect(() => {
    const handleDeviceAvailable = (_event: any, device: SelectableDevice) => {
      setDevices(prev => [...prev, device]);
    };

    ipcRenderer.on('device-available', handleDeviceAvailable);

    return () => {
      ipcRenderer.removeListener('device-available', handleDeviceAvailable);
    };
  }, []);

  const handleConnect = (device: SelectableDevice) => {
    const request: ConnectionRequest = {
      deviceId: device.id,
      type: device.type,
      serialData: device.serialData,
      networkData: device.networkData
    };

    ipcRenderer.send('connect-to-device', request);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Select Device</h1>
      {devices.length === 0 ? (
        <p>Discovering devices...</p>
      ) : (
        <ul>
          {devices.map(device => (
            <li key={device.id} style={{ marginBottom: '10px' }}>
              <strong>{device.name}</strong> ({device.description})
              <button
                onClick={() => handleConnect(device)}
                style={{ marginLeft: '10px', padding: '5px 10px' }}
              >
                Connect
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const container = document.getElementById('modal-root');
if (container) {
  const root = createRoot(container);
  root.render(<ModalApp />);
}
