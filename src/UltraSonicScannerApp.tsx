import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  Button,
  Popover,
  Box,
  Typography,
} from '@mui/material';
import { Devices as DevicesIcon } from '@mui/icons-material';

import { RongbukDevice } from './types/devices';
import { IpcRendererEvent } from 'electron';

import DeviceConnection from './DeviceConnection';
import type { CompleteScanData, ScanConfig } from './parser';
import ControlPanel from './ControlPanel';
import type { JsonConfig } from './ControlPanel';

import ScanChart from './ScanChart';

const { ipcRenderer } = window.require('electron');

const UltrasonicScannerApp: React.FC = () => {
  // Device popup state
  const [devicesAnchorEl, setDevicesAnchorEl] =
    useState<HTMLButtonElement | null>(null);
  const isDevicesPopupOpen = Boolean(devicesAnchorEl);

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

  const handleDevicesClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setDevicesAnchorEl(event.currentTarget);
  };

  const handleDevicesClose = () => {
    setDevicesAnchorEl(null);
  };

  const connectedDeviceCount = devices.filter(
    dev => dev.connectionState === 'CONNECTED'
  ).length;

  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: '1200px',
        margin: '0 auto',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Toolbar */}
      <AppBar
        position="static"
        color="default"
        elevation={1}
        sx={{
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Toolbar sx={{ minWidth: '800px', justifyContent: 'flex-start' }}>
          <Button
            variant="outlined"
            startIcon={<DevicesIcon />}
            onClick={handleDevicesClick}
            sx={{
              mr: 2,
              textTransform: 'none',
              minWidth: '120px',
            }}
          >
            Devices
            {connectedDeviceCount > 0 && (
              <Box
                component="span"
                sx={{
                  ml: 1,
                  px: 1,
                  py: 0.25,
                  backgroundColor: 'success.main',
                  color: 'white',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {connectedDeviceCount}
              </Box>
            )}
          </Button>

          {/* Future toolbar controls can be added here */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ ml: 'auto' }}
          >
            Ultrasonic Scanner Control
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Devices Popup */}
      <Popover
        open={isDevicesPopupOpen}
        anchorEl={devicesAnchorEl}
        onClose={handleDevicesClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '70vh',
            overflow: 'auto',
            mt: 1,
          },
        }}
      >
        <Box sx={{ p: 1 }}>
          <DeviceConnection
            devices={devices}
            onConnect={onDeviceConnect}
            onDisconnect={onDeviceDisconnect}
            onRefresh={onDeviceRefresh}
          />
        </Box>
      </Popover>

      {/* Main Content */}
      <Box sx={{ flex: 1, p: 2.5 }}>
        <ControlPanel
          disableSumbit={
            !devices.some(
              dev =>
                dev.connectionState === 'CONNECTED' &&
                Array.isArray(dev.location)
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
      </Box>
    </div>
  );
};

export default UltrasonicScannerApp;
