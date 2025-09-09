import React, { useState, useEffect, useCallback } from 'react';

import { RongbukDevice } from './types/devices';
import { IpcRendererEvent } from 'electron';

import DeviceConnection from './DeviceConnection';
import type { CompleteScanData, ScanConfig } from './parser';
import ControlPanel from './ControlPanel';
import type { JsonConfig } from './ControlPanel';

import ScanChart from './ScanChart';

const { ipcRenderer } = window.require('electron');
// Mock ScanChart component - replace with your actual import
// const ScanChart = ({ scanData }: { scanData: any }) => {
//   if (!scanData) {
//     return (
//       <div
//         style={{
//           width: '100%',
//           height: '400px',
//           border: '2px dashed #ddd',
//           borderRadius: '8px',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'center',
//           backgroundColor: '#f9f9f9',
//           color: '#666',
//         }}
//       >
//         No scan data available - waiting for scan completion
//       </div>
//     );
//   }

//   return (
//     <div
//       style={{
//         width: '100%',
//         height: '400px',
//         border: '1px solid #ddd',
//         borderRadius: '8px',
//         padding: '20px',
//         backgroundColor: '#fff',
//       }}
//     >
//       <h3>Scan Results</h3>
//       <p>
//         <strong>Scan Name:</strong> {scanData.config?.name || 'Unknown'}
//       </p>
//       <p>
//         <strong>Angles:</strong> {scanData.config?.numAngles || 0}
//       </p>
//       <p>
//         <strong>Data Points:</strong> {scanData.data?.angles?.length || 0}{' '}
//         angles
//       </p>
//       <div
//         style={{
//           marginTop: '20px',
//           padding: '15px',
//           backgroundColor: '#e7f3ff',
//           borderRadius: '4px',
//         }}
//       >
//         Chart visualization would appear here (import your ScanChart component)
//       </div>
//     </div>
//   );
// };

const UltrasonicScannerApp: React.FC = () => {
  // Scan data
  const [currentConfig, setCurrentConfig] = useState<JsonConfig>(null);
  const [scanData, setScanData] = useState<any>(null);
  const [devices, setDevices] = useState<RongbukDevice[]>([]);

  const handleDeviceUpdate = (
    event: IpcRendererEvent,
    device: RongbukDevice
  ) => {
    console.log('device udpate', device);
    if (typeof device.location === 'string') return;

    setDevices(prevDevices => {
      const index = prevDevices.findIndex(x => x.name === device.name);
      if (index < 0) {
        return [...prevDevices, device];
      } else {
        return [
          ...prevDevices.slice(0, index),
          device,
          ...prevDevices.slice(index + 1),
        ];
      }
    });
  };

  const handleDeviceScanData = (
    event: IpcRendererEvent,
    data: CompleteScanData
  ) => {
    console.log('scandata', data);
    setScanData(data);
  };

  useEffect(() => {
    ipcRenderer.on('device-update', handleDeviceUpdate);
    ipcRenderer.on('device-scandata', handleDeviceScanData);
    return () => {
      ipcRenderer.off('device-update', handleDeviceUpdate);
      ipcRenderer.off('device-scandata', handleDeviceScanData);
    };
  }, []);

  const onDeviceConnect = (device: RongbukDevice): void => {
    setImmediate(() => ipcRenderer.send('user-connect-device', device));
  };

  const onDeviceDisconnect = (device: RongbukDevice): void => {
    setImmediate(() => ipcRenderer.send('user-disconnect-device', device));
  };

  const onDeviceRefresh = (): void => {
    setDevices([]);
    setImmediate(() => ipcRenderer.send('user-refresh-devices'));
  };
  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: '1200px',
        margin: '20px auto',
        padding: '20px',
      }}
    >
      {/* Device Connection */}
      <DeviceConnection
        devices={devices}
        onConnect={onDeviceConnect}
        onDisconnect={onDeviceDisconnect}
        onRefresh={onDeviceRefresh}
      />

      <ControlPanel
        disableSumbit={
          !devices.some(
            dev =>
              dev.connectionState === 'CONNECTED' && Array.isArray(dev.location)
          )
        }
        onSubmit={(config: JsonConfig) => {
          ipcRenderer.send('user-submit-scan-config', config);
          setCurrentConfig(config);
        }}
      />

      {/* Scan Results */}
      <div
        style={{
          padding: '20px',
          border: '2px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fff',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
          Scan Results
        </h2>
        <ScanChart scanData={scanData} />
      </div>
    </div>
  );
};

export default UltrasonicScannerApp;
