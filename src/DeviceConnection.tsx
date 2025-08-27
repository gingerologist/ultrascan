import React, { useState, useEffect, useCallback } from 'react';

import type { RongbukDevice } from './types/devices';
// Import your types
// interface RongbukDevice {
//   connectionState: 'CONNECTED' | 'DISCONNECTED';
//   name: string;
//   location: string | string[];
// }

interface DeviceConnectionProps {
  className?: string;
}

const DeviceConnection: React.FC<DeviceConnectionProps> = ({
  className = '',
}) => {
  const [devices, setDevices] = useState<RongbukDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<RongbukDevice | null>(
    null
  );
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [connectionInProgress, setConnectionInProgress] =
    useState<boolean>(false);

  // Mock IPC functions - replace with real electron IPC
  const sendIPC = useCallback((channel: string, data?: any) => {
    console.log(`IPC: ${channel}`, data);

    if (channel === 'user-discover-device') {
      setIsDiscovering(true);

      // Mock device discovery with realistic timing
      setTimeout(() => {
        const mockDevices: RongbukDevice[] = [
          {
            connectionState: 'DISCONNECTED',
            name: 'USB Serial Port (COM14)',
            location: 'COM14',
          },
          {
            connectionState: 'DISCONNECTED',
            name: 'USB-SERIAL CH340 (COM7)',
            location: 'COM7',
          },
          {
            connectionState: 'DISCONNECTED',
            name: 'rongbuk-6767b0',
            location: ['192.168.3.119'],
          },
        ];
        setDevices(mockDevices);
        setIsDiscovering(false);
      }, 1500); // Simulate 1.5s discovery time
    }

    if (channel === 'user-select-device' && data) {
      setConnectionInProgress(true);

      // Mock connection attempt
      setTimeout(() => {
        // Update device state to connected
        setDevices(prev =>
          prev.map(dev =>
            dev === data
              ? { ...dev, connectionState: 'CONNECTED' as const }
              : dev
          )
        );
        setConnectionInProgress(false);
      }, 800);
    }
  }, []);

  // Listen for IPC events - replace with real electron IPC listeners
  useEffect(() => {
    // Mock IPC listeners
    const handleDeviceDiscovered = (device: RongbukDevice) => {
      setDevices(prev => {
        const exists = prev.some(d => d.location === device.location);
        return exists ? prev : [...prev, device];
      });
    };

    const handleDeviceConnected = (device: RongbukDevice) => {
      setDevices(prev =>
        prev.map(d =>
          d.location === device.location
            ? { ...d, connectionState: 'CONNECTED' }
            : d
        )
      );
    };

    const handleDeviceDisconnected = (device: RongbukDevice) => {
      setDevices(prev =>
        prev.map(d =>
          d.location === device.location
            ? { ...d, connectionState: 'DISCONNECTED' }
            : d
        )
      );
      if (selectedDevice?.location === device.location) {
        setSelectedDevice(null);
      }
    };

    // In real implementation, set up actual IPC listeners here
    // window.electronAPI.on.deviceDiscovered(handleDeviceDiscovered);
    // window.electronAPI.on.deviceConnected(handleDeviceConnected);
    // window.electronAPI.on.deviceDisconnected(handleDeviceDisconnected);

    return () => {
      // Cleanup IPC listeners
    };
  }, [selectedDevice]);

  const handleDiscoverDevices = useCallback(() => {
    setDevices([]);
    setSelectedDevice(null);
    sendIPC('user-discover-device');
  }, [sendIPC]);

  const handleConnectDevice = useCallback(
    (device: RongbukDevice) => {
      setSelectedDevice(device);
      sendIPC('user-select-device', device);
    },
    [sendIPC]
  );

  const handleDisconnectDevice = useCallback(() => {
    if (selectedDevice) {
      // Send disconnect command
      setDevices(prev =>
        prev.map(d =>
          d.location === selectedDevice.location
            ? { ...d, connectionState: 'DISCONNECTED' }
            : d
        )
      );
      setSelectedDevice(null);
    }
  }, [selectedDevice]);

  const formatLocation = (location: string | string[]): string => {
    if (Array.isArray(location)) {
      return location.join(', ');
    }
    return location;
  };

  const getDeviceType = (device: RongbukDevice): string => {
    if (Array.isArray(device.location)) {
      return 'Network (mDNS)';
    }
    return 'Serial Port';
  };

  const connectedDevice = devices.find(d => d.connectionState === 'CONNECTED');
  const hasConnectedDevice = !!connectedDevice;

  return (
    <div className={`device-connection ${className}`}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginBottom: '30px',
        }}
      >
        {/* Discovery Controls */}
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
          <button
            onClick={handleDiscoverDevices}
            disabled={isDiscovering || connectionInProgress}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor:
                isDiscovering || connectionInProgress
                  ? 'not-allowed'
                  : 'pointer',
              backgroundColor:
                isDiscovering || connectionInProgress ? '#6c757d' : '#28a745',
              color: '#fff',
              opacity: isDiscovering || connectionInProgress ? 0.6 : 1,
              minWidth: '120px',
            }}
          >
            {isDiscovering ? 'Discovering...' : 'Discover Devices'}
          </button>

          <span style={{ color: '#666', fontSize: '14px' }}>
            {isDiscovering
              ? 'Scanning for serial ports and network devices...'
              : devices.length > 0
              ? `Found ${devices.length} device(s)`
              : 'Click to scan for available devices'}
          </span>
        </div>

        {/* Device List */}
        {devices.length > 0 && (
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#fff',
            }}
          >
            <div
              style={{
                padding: '15px',
                borderBottom: '1px solid #eee',
                backgroundColor: '#f8f9fa',
                fontWeight: 'bold',
                borderRadius: '8px 8px 0 0',
              }}
            >
              Available Devices
            </div>

            {devices.map((device, index) => (
              <div
                key={`${device.location}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  borderBottom:
                    index < devices.length - 1 ? '1px solid #eee' : 'none',
                  backgroundColor:
                    device.connectionState === 'CONNECTED' ? '#e7f3ff' : '#fff',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {device.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {getDeviceType(device)} - {formatLocation(device.location)}
                  </div>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <div
                    style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor:
                        device.connectionState === 'CONNECTED'
                          ? '#d4edda'
                          : '#f8d7da',
                      color:
                        device.connectionState === 'CONNECTED'
                          ? '#155724'
                          : '#721c24',
                    }}
                  >
                    {device.connectionState}
                  </div>

                  {device.connectionState === 'DISCONNECTED' ? (
                    <button
                      onClick={() => handleConnectDevice(device)}
                      disabled={connectionInProgress || hasConnectedDevice}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor:
                          connectionInProgress || hasConnectedDevice
                            ? 'not-allowed'
                            : 'pointer',
                        backgroundColor:
                          connectionInProgress || hasConnectedDevice
                            ? '#6c757d'
                            : '#007bff',
                        color: '#fff',
                        opacity:
                          connectionInProgress || hasConnectedDevice ? 0.6 : 1,
                      }}
                    >
                      {connectionInProgress && selectedDevice === device
                        ? 'Connecting...'
                        : 'Connect'}
                    </button>
                  ) : (
                    <button
                      onClick={handleDisconnectDevice}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        backgroundColor: '#dc3545',
                        color: '#fff',
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connection Status */}
        <div
          style={{
            padding: '15px',
            borderRadius: '5px',
            border: '1px solid #dee2e6',
            backgroundColor: hasConnectedDevice
              ? '#d4edda'
              : connectionInProgress
              ? '#fff3cd'
              : '#f8d7da',
            color: hasConnectedDevice
              ? '#155724'
              : connectionInProgress
              ? '#856404'
              : '#721c24',
            borderColor: hasConnectedDevice
              ? '#c3e6cb'
              : connectionInProgress
              ? '#ffeaa7'
              : '#f5c6cb',
          }}
        >
          {hasConnectedDevice
            ? `Connected to ${connectedDevice.name} - Ready for scanning`
            : connectionInProgress
            ? 'Connecting to device...'
            : 'No device connected - Discover and connect to a device to begin'}
        </div>
      </div>
    </div>
  );
};

export default DeviceConnection;
