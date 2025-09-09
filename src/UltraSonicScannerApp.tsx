import React, { useState, useEffect, useCallback } from 'react';
import { AppBar, Toolbar, Typography, Tabs, Tab, Box } from '@mui/material';

import { RongbukDevice } from './types/devices';
import { IpcRendererEvent } from 'electron';

import DeviceConnection from './DeviceConnection';
import type { CompleteScanData, ScanConfig } from './parser';
import ControlPanel from './ControlPanel';
import type { JsonConfig } from './ControlPanel';

import ScanChart from './ScanChart';

const { ipcRenderer } = window.require('electron');

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const UltrasonicScannerApp: React.FC = () => {
  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

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
        <Toolbar sx={{ minWidth: '800px' }}>
          <Typography variant="h6" color="text.primary" sx={{ flexGrow: 1 }}>
            Ultrasonic Scanner
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          aria-label="scanner tabs"
        >
          <Tab label="Devices" {...a11yProps(0)} />
          <Tab label="Configuration" {...a11yProps(1)} />
          <Tab label="Results" {...a11yProps(2)} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1 }}>
        {/* Devices Tab */}
        <TabPanel value={currentTab} index={0}>
          <DeviceConnection
            devices={devices}
            onConnect={onDeviceConnect}
            onDisconnect={onDeviceDisconnect}
            onRefresh={onDeviceRefresh}
          />
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={currentTab} index={1}>
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
              // Switch to Results tab after submitting configuration
              // setCurrentTab(2);
            }}
          />
        </TabPanel>

        {/* Results Tab */}
        <TabPanel value={currentTab} index={2}>
          <div
            style={{
              padding: '20px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#fff',
            }}
          >
            <ScanChart scanData={scanData} />
          </div>
        </TabPanel>
      </Box>
    </div>
  );
};

export default UltrasonicScannerApp;
