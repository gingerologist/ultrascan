import React, { useState, useEffect, useCallback } from 'react';

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

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SerialDevice {
  id: string;
  name: string;
}

const UltrasonicScannerApp: React.FC = () => {
  // Connection state
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [availableDevices, setAvailableDevices] = useState<SerialDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  // Scan data
  const [scanData, setScanData] = useState<any>(null);

  // Mock device list - in real app, this would come from main process via IPC
  useEffect(() => {
    // Simulate device discovery
    const mockDevices = [
      { id: 'COM3', name: 'CH340 USB Serial (COM3)' },
      { id: 'COM4', name: 'FTDI USB Serial (COM4)' },
    ];
    setAvailableDevices(mockDevices);
  }, []);

  // Mock IPC communication - replace with actual electron IPC calls
  const sendToMainProcess = useCallback((channel: string, data?: any) => {
    console.log(`IPC Send: ${channel}`, data);

    // Mock responses for demonstration
    if (channel === 'serial:connect') {
      setConnectionState('connecting');
      setTimeout(() => {
        setConnectionState('connected');
        console.log('Mock: Connected to device');
      }, 1000);
    } else if (channel === 'serial:disconnect') {
      setConnectionState('disconnected');
      setScanData(null);
      console.log('Mock: Disconnected from device');
    }
  }, []);

  // Mock scan data reception - in real app, this would come from main process
  useEffect(() => {
    if (connectionState === 'connected') {
      // Simulate receiving scan data after a few seconds
      const timer = setTimeout(() => {
        const mockScanData = {
          config: {
            name: 'Test Scan',
            numAngles: 3,
            captureStartUs: 50,
            captureEndUs: 200,
            angles: [
              { numSteps: 10, label: '0 degrees' },
              { numSteps: 12, label: '45 degrees' },
              { numSteps: 8, label: '90 degrees' },
            ],
          },
          data: {
            angles: [
              {
                index: 0,
                label: '0 degrees',
                steps: [
                  { index: 0, channels: [] }, // Mock empty for now
                  { index: 1, channels: [] },
                ],
              },
            ],
          },
        };
        setScanData(mockScanData);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [connectionState]);

  const handleConnect = useCallback(() => {
    if (!selectedDevice) {
      alert('Please select a device first');
      return;
    }
    sendToMainProcess('serial:connect', { deviceId: selectedDevice });
  }, [selectedDevice, sendToMainProcess]);

  const handleDisconnect = useCallback(() => {
    sendToMainProcess('serial:disconnect');
  }, [sendToMainProcess]);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const hasDeviceSelected = selectedDevice !== '';

  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: '1200px',
        margin: '20px auto',
        padding: '20px',
      }}
    >
      <h1>Ultrasonic Scanner Interface</h1>

      {/* Connection Controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginBottom: '30px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            padding: '15px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: 1,
            }}
          >
            <label style={{ fontWeight: 'bold', minWidth: '120px' }}>
              Serial Device:
            </label>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              disabled={isConnected || isConnecting}
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '200px',
                backgroundColor:
                  isConnected || isConnecting ? '#f5f5f5' : '#fff',
                color: isConnected || isConnecting ? '#999' : '#000',
              }}
            >
              <option value="">
                {availableDevices.length === 0
                  ? 'No devices found'
                  : 'Select a device...'}
              </option>
              {availableDevices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <button
              onClick={handleConnect}
              disabled={!hasDeviceSelected || isConnected || isConnecting}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor:
                  !hasDeviceSelected || isConnected || isConnecting
                    ? 'not-allowed'
                    : 'pointer',
                minWidth: '80px',
                backgroundColor:
                  !hasDeviceSelected || isConnected || isConnecting
                    ? '#6c757d'
                    : '#007bff',
                color: '#fff',
                opacity:
                  !hasDeviceSelected || isConnected || isConnecting ? 0.6 : 1,
              }}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>

            <button
              onClick={handleDisconnect}
              disabled={!isConnected}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: !isConnected ? 'not-allowed' : 'pointer',
                minWidth: '80px',
                backgroundColor: !isConnected ? '#6c757d' : '#007bff',
                color: '#fff',
                opacity: !isConnected ? 0.6 : 1,
              }}
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div
          style={{
            padding: '15px',
            borderRadius: '5px',
            border: '1px solid #dee2e6',
            minHeight: '20px',
            backgroundColor:
              connectionState === 'connected'
                ? '#d4edda'
                : connectionState === 'connecting'
                ? '#fff3cd'
                : connectionState === 'error'
                ? '#f8d7da'
                : '#f8d7da',
            color:
              connectionState === 'connected'
                ? '#155724'
                : connectionState === 'connecting'
                ? '#856404'
                : connectionState === 'error'
                ? '#721c24'
                : '#721c24',
            borderColor:
              connectionState === 'connected'
                ? '#c3e6cb'
                : connectionState === 'connecting'
                ? '#ffeaa7'
                : connectionState === 'error'
                ? '#f5c6cb'
                : '#f5c6cb',
          }}
        >
          {connectionState === 'connected' &&
            'Connected to device - ready for scanning'}
          {connectionState === 'connecting' && 'Connecting to device...'}
          {connectionState === 'disconnected' &&
            'Disconnected - select a device and connect'}
          {connectionState === 'error' && 'Connection error - please try again'}
        </div>
      </div>

      {/* Control Panel */}
      <div
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
      </div>

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
