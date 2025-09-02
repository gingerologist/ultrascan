import React, { useState, useEffect, useCallback } from 'react';

import { RongbukDevice } from './types/devices';
import { IpcRendererEvent } from 'electron';

import DeviceConnection from './DeviceConnection';
import type { ScanConfig } from './parser';
import ControlPanel from './ControlPanel';
import type { JsonConfig } from './ControlPanel';

const { ipcRenderer } = window.require('electron');
// Mock ScanChart component - replace with your actual import
const ScanChart = ({ scanData }: { scanData: any }) => {
  if (!scanData) {
    return (
      <div
        style={{
          width: '100%',
          height: '400px',
          border: '2px dashed #ddd',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9f9f9',
          color: '#666',
        }}
      >
        No scan data available - waiting for scan completion
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '400px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        backgroundColor: '#fff',
      }}
    >
      <h3>Scan Results</h3>
      <p>
        <strong>Scan Name:</strong> {scanData.config?.name || 'Unknown'}
      </p>
      <p>
        <strong>Angles:</strong> {scanData.config?.numAngles || 0}
      </p>
      <p>
        <strong>Data Points:</strong> {scanData.data?.angles?.length || 0}{' '}
        angles
      </p>
      <div
        style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#e7f3ff',
          borderRadius: '4px',
        }}
      >
        Chart visualization would appear here (import your ScanChart component)
      </div>
    </div>
  );
};

const UltrasonicScannerApp: React.FC = () => {
  // Scan data
  const [currentConfig, setCurrentConfig] = useState(null);
  const [scanData, setScanData] = useState<any>(null);
  const [devices, setDevices] = useState<RongbukDevice[]>([]);

  const handleDeviceUpdate = (
    event: IpcRendererEvent,
    device: RongbukDevice
  ) => {
    console.log('device udpate', device);
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

  useEffect(() => {
    ipcRenderer.on('device-update', handleDeviceUpdate);
    return () => ipcRenderer.off('device-update', handleDeviceUpdate);
  }, []);

  // Mock scan data reception - in real app, this would come from main process
  // useEffect(() => {
  //   // Simulate receiving scan data after some time
  //   const timer = setTimeout(() => {
  //     const mockScanData = {
  //       config: {
  //         name: 'Test Scan',
  //         numAngles: 3,
  //         captureStartUs: 50,
  //         captureEndUs: 200,
  //         angles: [
  //           { numSteps: 10, label: '0 degrees' },
  //           { numSteps: 12, label: '45 degrees' },
  //           { numSteps: 8, label: '90 degrees' },
  //         ],
  //       },
  //       data: {
  //         angles: [
  //           {
  //             index: 0,
  //             label: '0 degrees',
  //             steps: [
  //               { index: 0, channels: [] },
  //               { index: 1, channels: [] },
  //             ],
  //           },
  //         ],
  //       },
  //     };
  //     setScanData(mockScanData);
  //   }, 5000); // Show scan data after 5 seconds

  //   return () => clearTimeout(timer);
  // }, []);

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
        onConfigChange={(config: JsonConfig) => {
          setCurrentConfig(config);
          // console.log('Configuration updated:', config);
        }}
      />

      {/* Control Panel */}
      {/* <div
        style={{
          marginBottom: '30px',
          padding: '20px',
          border: '2px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fff',
          minHeight: '150px',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
          Control Panel
        </h2>
        <div
          style={{
            color: '#666',
            fontStyle: 'italic',
            textAlign: 'center',
            marginTop: '50px',
          }}
        >
          Scan configuration controls will be implemented here.
          <br />
          Future features: pattern configuration, angle settings, capture
          parameters.
        </div>
      </div> */}

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
