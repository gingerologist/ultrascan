import React, { useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Spinner,
  HStack,
  VStack,
} from '@chakra-ui/react';
import { Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/table';
import { RepeatIcon } from '@chakra-ui/icons';

import type { RongbukDevice } from './types/devices';

/*
// Define the device type (adjust according to your actual type)
interface RongbukDevice {
  name: string;
  location: string | string[];
  connectionState:
    | 'CONNECTED'
    | 'CONNECTING'
    | 'DISCONNECTING'
    | 'DISCONNECTED';
} */

interface RongbukDevicesProps {
  devices: RongbukDevice[];
  onConnect: (device: RongbukDevice) => void;
  onDisconnect: (device: RongbukDevice) => void;
  onRefresh: () => void;
}

const RongbukDevices: React.FC<RongbukDevicesProps> = ({
  devices,
  onConnect,
  onDisconnect,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [debouncing, setDebouncing] = useState<boolean>(false);

  const debounce = () => {
    setDebouncing(true);
    setTimeout(() => setDebouncing(false), 500);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

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

  return (
    <Box
      bg="white"
      border="2px solid"
      borderColor="gray.200"
      borderRadius="lg"
      p={5}
      mb={8}
    >
      {/* Header */}
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md" color="gray.700">
          Rongbuk Devices
        </Heading>
        <Button
          onClick={handleRefresh}
          loading={refreshing}
          loadingText="Refreshing"
          // leftIcon={refreshing ? <Spinner size="sm" /> : <RepeatIcon />} TODO:
          colorScheme="blue"
          size="sm"
        >
          Refresh
        </Button>
      </Flex>

      {/* Device Table */}
      <Box
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        overflow="hidden"
      >
        <Table variant="simple" size="md">
          <Thead bg="gray.50">
            <Tr>
              <Th color="gray.600" fontWeight="bold">
                Device Name
              </Th>
              <Th color="gray.600" fontWeight="bold">
                Location
              </Th>
              <Th color="gray.600" fontWeight="bold" textAlign="right">
                Actions
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {devices.length === 0 ? (
              <Tr>
                <Td colSpan={3} textAlign="center" py={12}>
                  <Text color="gray.500" fontStyle="italic">
                    No devices found. Click refresh to scan for devices.
                  </Text>
                </Td>
              </Tr>
            ) : (
              devices.map(device => {
                const {
                  isConnected,
                  isConnecting,
                  isDisconnecting,
                  isTransitioning,
                } = getButtonState(device);

                return (
                  <Tr key={device.name} _hover={{ bg: 'gray.50' }}>
                    <Td>
                      <Text fontWeight="bold" color="gray.700">
                        {device.name}
                      </Text>
                    </Td>
                    <Td>
                      <Text color="gray.600" fontSize="sm">
                        {formatLocation(device.location)}
                      </Text>
                    </Td>
                    <Td textAlign="right">
                      <HStack justify="flex-end" gap={2}>
                        <Button
                          onClick={() => {
                            debounce();
                            onConnect(device);
                          }}
                          disabled={isConnected || isTransitioning}
                          colorScheme="green"
                          size="sm"
                          minW="80px"
                          loading={isConnecting}
                        >
                          Connect
                        </Button>
                        <Button
                          onClick={() => {
                            debounce();
                            onDisconnect(device);
                          }}
                          disabled={!isConnected || isTransitioning}
                          colorScheme="red"
                          size="sm"
                          minW="80px"
                          loading={isDisconnecting}
                        >
                          Disconnect
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Device count */}
      {devices.length > 0 && (
        <Text mt={3} textAlign="right" fontSize="sm" color="gray.600">
          {devices.length} device{devices.length !== 1 ? 's' : ''} found
        </Text>
      )}
    </Box>
  );
};

// Demo wrapper to show the component
/*
const App = () => {
  const [devices, setDevices] = useState<RongbukDevice[]>([
    {
      name: 'USB Serial Port (COM14)',
      location: 'COM14',
      connectionState: 'DISCONNECTED',
    },
    {
      name: 'USB-SERIAL CH340 (COM7)',
      location: 'COM7',
      connectionState: 'CONNECTED',
    },
    {
      name: 'rongbuk-676700',
      location: '192.168.3.119',
      connectionState: 'DISCONNECTED',
    },
  ]);

  const handleConnect = (device: RongbukDevice) => {
    setDevices(prev =>
      prev.map(d =>
        d.name === device.name
          ? { ...d, connectionState: 'CONNECTING' as const }
          : d
      )
    );

    // Simulate connection
    setTimeout(() => {
      setDevices(prev =>
        prev.map(d =>
          d.name === device.name
            ? { ...d, connectionState: 'CONNECTED' as const }
            : d
        )
      );
    }, 1000);
  };

  const handleDisconnect = (device: RongbukDevice) => {
    setDevices(prev =>
      prev.map(d =>
        d.name === device.name
          ? { ...d, connectionState: 'DISCONNECTING' as const }
          : d
      )
    );

    // Simulate disconnection
    setTimeout(() => {
      setDevices(prev =>
        prev.map(d =>
          d.name === device.name
            ? { ...d, connectionState: 'DISCONNECTED' as const }
            : d
        )
      );
    }, 1000);
  };

  const handleRefresh = async () => {
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 800));
  };

  return (
    <Box maxW="1200px" mx="auto" p={5}>
      <Heading mb={6}>Ultrasonic Scanner Interface</Heading>
      <RongbukDevices
        devices={devices}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onRefresh={handleRefresh}
      />
    </Box>
  );
}; */

export default RongbukDevices;
