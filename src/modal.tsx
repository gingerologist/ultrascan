import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { RongbukDevice } from './types/devices';

const { ipcRenderer } = window.require('electron');

const ModalApp: React.FC = () => {
  const [devices, setDevices] = useState<RongbukDevice[]>([]);

  useEffect(() => {
    const handleDeviceAvailable = (_event: any, device: RongbukDevice) => {
      setDevices(prev => [...prev, device]);
    };

    ipcRenderer.on('device-discovered', handleDeviceAvailable);

    return () => ipcRenderer.off('device-discovered', handleDeviceAvailable);
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Select Device</h1>
      {devices.length === 0 ? (
        <p>Discovering devices...</p>
      ) : (
        <ul>
          {devices.map(device => (
            <li key={device.name} style={{ marginBottom: '10px' }}>
              <strong>{device.name}</strong> ({device.location})
              <button
                onClick={() => {
                  ipcRenderer.send('user-select-device', device);
                }}
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
