import React from 'react';

interface RongbukDevice {
  connectionState: 'CONNECTED' | 'DISCONNECTED';
  name: string;
  location: string | string[];
}

interface DeviceConnectionPureProps {
  // Device state - null means no device has been selected/connected yet
  device: RongbukDevice | null;

  // Event handlers
  onConnect: () => void;
  onDisconnect: () => void;
  onConnectAnother: () => void;

  // Optional styling
  className?: string;
}

const DeviceConnectionPure: React.FC<DeviceConnectionPureProps> = ({
  device,
  onConnect,
  onDisconnect,
  onConnectAnother,
  className = '',
}) => {
  // Helper function to format device location
  const formatLocation = (location: string | string[]): string => {
    return Array.isArray(location) ? location[0] : location;
  };

  // Helper function to get device type
  const getDeviceType = (location: string | string[]): string => {
    return Array.isArray(location) ? 'Network' : 'Serial';
  };

  // Determine current state for UI logic
  const isNoDevice = device === null;
  const isConnected = device?.connectionState === 'CONNECTED';
  const isDisconnected = device?.connectionState === 'DISCONNECTED';

  // Button states
  const connectEnabled = isNoDevice;
  const disconnectEnabled = isConnected;
  const reconnectEnabled = isDisconnected;
  const connectAnotherEnabled = isDisconnected;

  return (
    <div className={`device-connection-pure ${className}`}>
      <div
        style={{
          padding: '20px',
          border: '2px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fff',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>
          Device Connection
        </h3>

        {/* Device Status Display */}
        <div
          style={{
            padding: '15px',
            marginBottom: '20px',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            backgroundColor: isConnected
              ? '#e7f3ff'
              : isDisconnected
              ? '#fff3cd'
              : '#f8f9fa',
          }}
        >
          {isNoDevice ? (
            <div>
              <div style={{ fontWeight: 'bold', color: '#666' }}>
                No device selected
              </div>
              <div
                style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}
              >
                Click "Connect" to discover and select a device
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{device.name}</div>
                <div
                  style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
                    color: isConnected ? '#155724' : '#721c24',
                  }}
                >
                  {device.connectionState}
                </div>
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {getDeviceType(device.location)} -{' '}
                {formatLocation(device.location)}
              </div>
              {isConnected && (
                <div
                  style={{
                    fontSize: '12px',
                    color: '#28a745',
                    marginTop: '4px',
                  }}
                >
                  Ready for scanning operations
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - Fixed Layout */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          {/* Connect Button */}
          <button
            onClick={onConnect}
            disabled={!connectEnabled}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: connectEnabled ? 'pointer' : 'not-allowed',
              backgroundColor: connectEnabled ? '#28a745' : '#6c757d',
              color: '#fff',
              opacity: connectEnabled ? 1 : 0.6,
              minWidth: '100px',
            }}
          >
            Connect
          </button>

          {/* Disconnect Button */}
          <button
            onClick={onDisconnect}
            disabled={!disconnectEnabled}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: disconnectEnabled ? 'pointer' : 'not-allowed',
              backgroundColor: disconnectEnabled ? '#dc3545' : '#6c757d',
              color: '#fff',
              opacity: disconnectEnabled ? 1 : 0.6,
              minWidth: '100px',
            }}
          >
            Disconnect
          </button>

          {/* Reconnect Button - Only visible when disconnected */}
          {device && (
            <button
              onClick={onConnect}
              disabled={!reconnectEnabled}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: reconnectEnabled ? 'pointer' : 'not-allowed',
                backgroundColor: reconnectEnabled ? '#007bff' : '#6c757d',
                color: '#fff',
                opacity: reconnectEnabled ? 1 : 0.6,
                minWidth: '100px',
              }}
            >
              Reconnect
            </button>
          )}

          {/* Connect Another Button - Only visible when disconnected */}
          {device && (
            <button
              onClick={onConnectAnother}
              disabled={!connectAnotherEnabled}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: connectAnotherEnabled ? 'pointer' : 'not-allowed',
                backgroundColor: connectAnotherEnabled ? '#6f42c1' : '#6c757d',
                color: '#fff',
                opacity: connectAnotherEnabled ? 1 : 0.6,
                minWidth: '140px',
              }}
            >
              Connect Another
            </button>
          )}
        </div>

        {/* Status Messages */}
        <div
          style={{
            marginTop: '15px',
            fontSize: '13px',
            color: '#666',
            fontStyle: 'italic',
          }}
        >
          {isNoDevice &&
            'Use "Connect" to discover serial ports and network devices'}
          {isConnected && 'Device is ready for scan operations'}
          {isDisconnected &&
            'Device disconnected - use "Reconnect" or "Connect Another"'}
        </div>
      </div>
    </div>
  );
};

export default DeviceConnectionPure;
