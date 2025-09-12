import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Box,
  Button,
  FormLabel,
  CircularProgress,
  LinearProgress,
} from '@mui/material';

import { RongbukDevice, Frac } from './types/devices';
import { IpcRendererEvent } from 'electron';

import DeviceConnection from './DeviceConnection';
import type { CompleteScanData, ScanConfig } from './parser';
import ControlPanel, { defaultConfig } from './ControlPanel';
import type { JsonConfig } from './ControlPanel';

import { Refresh } from '@mui/icons-material';
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
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const RongbukApp: React.FC = () => {
  // Mediator
  const [onResetClick, setOnResetClick] = useState<() => void>(() => () => {});
  const onOffResetClick = useCallback((handler: () => void) => {
    setOnResetClick(() => handler);
    console.log('RestButtonClick handler on', handler);
    return () => {
      setOnResetClick(() => () => {});
      console.log('ResetButtonClick handler off', handler);
    };
  }, []);

  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

  // Scan data
  const [currentConfig, setCurrentConfig] = useState<JsonConfig | null>(null);
  const [scanconfig, setScanConfig] = useState<ScanConfig | null>(null);
  const [scanData, setScanData] = useState<any>(null);
  const [devices, setDevices] = useState<RongbukDevice[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(100);
  const [numerator, setNumerator] = useState<number>(0);
  const [denominator, setDenominator] = useState<number>(0);

  const denom = useRef(denominator);
  useEffect(() => {
    denom.current = denominator;
  }, [denominator]);

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
    const handleDeviceScanCfg = (event: IpcRendererEvent, cfg: ScanConfig) => {
      console.log('scancfg', cfg);
      setScanConfig(cfg);
      setProgress(0);
      setNumerator(0);
      setDenominator(cfg.totalSteps * 64);
    };
    const handleDevicePktRcvd = (event: IpcRendererEvent, rcvd: number) => {
      setNumerator(rcvd);
      const den = denom.current;
      const progr = (rcvd * 100) / den;
      console.log('pktrcvd, denom, progress', rcvd, den, progr);
      setProgress(progr);
    };

    ipcRenderer.on('device-update', handleDeviceUpdate);
    ipcRenderer.on('device-scandata', handleDeviceScanData);
    ipcRenderer.on('device-scancfg', handleDeviceScanCfg);
    ipcRenderer.on('device-pktrcvd', handleDevicePktRcvd);
    return () => {
      ipcRenderer.off('device-update', handleDeviceUpdate);
      ipcRenderer.off('device-scandata', handleDeviceScanData);
      ipcRenderer.off('device-scancfg', handleDeviceScanCfg);
      ipcRenderer.off('device-pktrcvd', handleDevicePktRcvd);
    };
  }, []);

  const onDeviceConnect = (device: RongbukDevice): void => {
    setImmediate(() => ipcRenderer.send('user-connect-device', device));
  };

  const onDeviceDisconnect = (device: RongbukDevice): void => {
    setImmediate(() => ipcRenderer.send('user-disconnect-device', device));
  };

  const onDeviceRefresh = (): void => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
    setDevices([]);
    setImmediate(() => ipcRenderer.send('user-refresh-devices'));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const isConnected = devices.some(
    dev => dev.connectionState === 'CONNECTED' && Array.isArray(dev.location)
  );

  const isScanning = progress !== 100;

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
      <AppBar elevation={1}>
        <Toolbar sx={{ justifyContent: 'center' }}>
          <Typography variant="h5">
            {isScanning
              ? `received: ${numerator} / total: ${denominator}`
              : 'Project Rongbuk'}
          </Typography>
        </Toolbar>
        <LinearProgress
          variant={progress === 0 ? 'indeterminate' : 'determinate'}
          value={progress}
        />
      </AppBar>

      {/* Tab Navigation */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
        }}
        mt={5}
      >
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          aria-label="scanner tabs"
          sx={{ flexGrow: 1 }}
        >
          <Tab label="Devices" {...a11yProps(0)} />
          <Tab label="Configuration" {...a11yProps(1)} />
          <Tab label="Results" {...a11yProps(2)} />
        </Tabs>

        {currentTab == 0 && (
          <Button
            size="small"
            onClick={onDeviceRefresh}
            disabled={refreshing || isScanning}
            startIcon={
              refreshing ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Refresh />
              )
            }
          >
            Refresh
          </Button>
        )}

        {currentTab == 1 && (
          <Button disabled={isScanning} onClick={() => onResetClick()}>
            Reset
          </Button>
        )}

        {currentTab == 1 && (
          <Button
            disabled={!isConnected || isScanning}
            sx={{ ml: 2 }}
            onClick={() => {
              ipcRenderer.send('user-submit-scan-config', currentConfig);
              setProgress(0);
              setNumerator(0);
              setDenominator(0);
            }}
          >
            Submit
          </Button>
        )}
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1 }}>
        {/* Devices Tab */}
        <TabPanel value={currentTab} index={0}>
          <DeviceConnection
            devices={devices}
            onConnect={onDeviceConnect}
            onDisconnect={onDeviceDisconnect}
          />
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={currentTab} index={1}>
          <ControlPanel
            // disableSumbit={
            //   !devices.some(
            //     dev =>
            //       dev.connectionState === 'CONNECTED' &&
            //       Array.isArray(dev.location)
            //   )
            // }
            // onSubmit={(config: JsonConfig) => {
            //   ipcRenderer.send('user-submit-scan-config', config);
            //   setCurrentConfig(config);
            // }}
            onConfigChange={(cfg: JsonConfig) => setCurrentConfig(cfg)}
            onOffResetClick={onOffResetClick}
          />
        </TabPanel>

        {/* Results Tab */}
        <TabPanel value={currentTab} index={2}>
          <Box>
            <ScanChart scanData={scanData} />
          </Box>
        </TabPanel>
      </Box>
    </div>
  );
};

export default RongbukApp;
