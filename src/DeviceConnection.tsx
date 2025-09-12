import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Wifi as ConnectIcon,
  WifiOff as DisconnectIcon,
} from '@mui/icons-material';

import type { RongbukDevice } from './types/devices';

interface RongbukDevicesProps {
  devices: RongbukDevice[];
  onConnect: (device: RongbukDevice) => void;
  onDisconnect: (device: RongbukDevice) => void;
  // onRefresh: () => void;
}

const RongbukDevices: React.FC<RongbukDevicesProps> = ({
  devices,
  onConnect,
  onDisconnect,
  // onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [debouncing, setDebouncing] = useState<boolean>(false);

  const debounce = () => {
    setDebouncing(true);
    setTimeout(() => setDebouncing(false), 500);
  };

  // const handleRefresh = async () => {
  //   setRefreshing(true);
  //   await onRefresh();
  //   setTimeout(() => setRefreshing(false), 500);
  // };

  const formatLocation = (location: string | string[]): string => {
    if (Array.isArray(location)) {
      return location.join(', ');
    }
    return location;
  };

  const getButtonState = (device: RongbukDevice) => {
    const isConnected = device.connectionState === 'CONNECTED';
    const isConnecting = device.connectionState === 'CONNECTING';
    const isDisconnecting = device.connectionState === 'DISCONNECTING';

    return {
      isConnected,
      isConnecting,
      isDisconnecting,
      isTransitioning: isConnecting || isDisconnecting || debouncing,
    };
  };

  const getConnectionColor = (state: RongbukDevice['connectionState']) => {
    switch (state) {
      case 'CONNECTED':
        return 'success.main';
      case 'CONNECTING':
      case 'DISCONNECTING':
        return 'warning.main';
      case 'DISCONNECTED':
      default:
        return 'text.secondary';
    }
  };

  return (
    <Box mt={2}>
      {/* Device Table */}
      <TableContainer component={Box}>
        <Table size="medium">
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell
                sx={{
                  color: 'text.secondary',
                  fontWeight: 'bold',
                  width: '30%',
                }}
              >
                Device Name
              </TableCell>
              <TableCell
                sx={{
                  color: 'text.secondary',
                  fontWeight: 'bold',
                  width: '30%',
                }}
              >
                Address
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 'bold',
                  width: '40%',
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow></TableRow>
            ) : (
              devices.map(device => {
                const {
                  isConnected,
                  isConnecting,
                  isDisconnecting,
                  isTransitioning,
                } = getButtonState(device);

                return (
                  <TableRow
                    key={device.name}
                    hover
                    sx={{
                      '&:hover': {
                        bgcolor: 'grey.50',
                      },
                    }}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: getConnectionColor(device.connectionState),
                          }}
                        />
                        <Typography
                          fontWeight="bold"
                          color="text.primary"
                          variant="body2"
                        >
                          {device.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography color="text.secondary" variant="body2">
                        {formatLocation(device.location)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                      >
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => {
                            debounce();
                            onConnect(device);
                          }}
                          disabled={isConnected || isTransitioning}
                          startIcon={
                            isConnecting ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              <ConnectIcon fontSize="small" />
                            )
                          }
                          sx={{ minWidth: 100 }}
                        >
                          {isConnecting ? 'Connecting...' : 'Connect'}
                        </Button>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => {
                            debounce();
                            onDisconnect(device);
                          }}
                          disabled={!isConnected || isTransitioning}
                          startIcon={
                            isDisconnecting ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              <DisconnectIcon fontSize="small" />
                            )
                          }
                          sx={{ minWidth: 100 }}
                        >
                          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Device count */}
      {devices.length > 0 && (
        <Typography
          mt={2}
          textAlign="right"
          variant="body2"
          color="text.secondary"
        >
          {devices.length} device{devices.length !== 1 ? 's' : ''} found
        </Typography>
      )}
    </Box>
  );
};

export default RongbukDevices;
