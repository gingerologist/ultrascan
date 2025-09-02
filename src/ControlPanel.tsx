import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Select,
  MenuItem,
  Slider,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';

import {
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useTheme, SxProps } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

import PatternControl from './PatternControl';
import type { PatternUnit } from './PatternControl';

// Type definitions matching your schema
interface JsonAngle {
  degree: number;
  masks: number[];
}

type JsonPatternSegment = [number, number]; // [duration, level]

export interface JsonConfig {
  version: string;
  name: string;
  angles: JsonAngle[];
  patterns: JsonPatternSegment[];
  repeat: number;
  tail: number;
  txStartDel: number;
  startUs: number;
  endUs: number;
}

interface ControlPanelProps {
  onConfigChange?: (config: JsonConfig) => void;
}

// These styles are from official slider customization examples.
const iOSBoxShadow =
  '0 3px 1px rgba(0,0,0,0.1),0 4px 8px rgba(0,0,0,0.13),0 0 0 1px rgba(0,0,0,0.02)';
const getIOSSliderStyleEx: SxProps = (theme: Theme) => ({
  color: '#007bff',
  height: 5,
  padding: '15px 0',
  '& .MuiSlider-thumb': {
    height: 20,
    width: 20,
    backgroundColor: '#fff',
    boxShadow: '0 0 2px 0px rgba(0, 0, 0, 0.1)',
    '&:focus, &:hover, &.Mui-active': {
      boxShadow: '0px 0px 3px 1px rgba(0, 0, 0, 0.1)',
      // Reset on touch devices, it doesn't add specificity
      '@media (hover: none)': {
        boxShadow: iOSBoxShadow,
      },
    },
    '&:before': {
      boxShadow:
        '0px 0px 1px 0px rgba(0,0,0,0.2), 0px 0px 0px 0px rgba(0,0,0,0.14), 0px 0px 1px 0px rgba(0,0,0,0.12)',
    },
  },
  '& .MuiSlider-valueLabel': {
    fontSize: 12,
    fontWeight: 'normal',
    top: -6,
    backgroundColor: 'unset',
    color: theme.palette.text.primary,
    '&::before': {
      display: 'none',
    },
    '& *': {
      background: 'transparent',
      color: '#000',
      ...theme.applyStyles('dark', {
        color: '#fff',
      }),
    },
  },
  '& .MuiSlider-track': {
    border: 'none',
    height: 5,
  },
  '& .MuiSlider-rail': {
    opacity: 0.5,
    boxShadow: 'inset 0px 0px 4px -2px #000',
    backgroundColor: '#d0d0d0',
  },
});

const defaultConfig: JsonConfig = {
  version: '1.0',
  name: '',
  angles: [],
  patterns: [],
  repeat: 2,
  tail: 5,
  txStartDel: -1,
  startUs: 40,
  endUs: 80,
};

const defaultPattern: PatternUnit[] = Array(16)
  .fill(null)
  .map((_, index) =>
    index === 0
      ? { range: 2, position: 'top' as const }
      : { range: 2, position: 'none' as const }
  );

const UltrasonicControlPanel: React.FC<ControlPanelProps> = ({
  onConfigChange,
}) => {
  const theme = useTheme();
  const iosStyleEx: SxProps = getIOSSliderStyleEx(theme);
  const tableRowSx: SxProps = { height: 136 };

  const [config, setConfig] = useState<JsonConfig>(defaultConfig);

  const [angleRange, setAngleRange] = useState<[number, number]>([0, 0]);
  const [selectedDivisor, setSelectedDivisor] = useState(2);
  const [availableDivisors, setAvailableDivisors] = useState<number[]>([]);
  const [steps, setSteps] = useState(1);
  const [patternUnits, setPatternUnits] =
    useState<PatternUnit[]>(defaultPattern);

  const updateConfig = useCallback(
    (updates: Partial<JsonConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);

      if (onConfigChange) {
        onConfigChange(newConfig);
      }
    },
    [config, onConfigChange]
  );

  const resetConfig = () => {
    setConfig(defaultConfig);
    setPatternUnits(defaultPattern);
    setAngleRange([0, 0]);
    setSelectedDivisor(2);
    setAvailableDivisors([]);
    setSteps(1);
  };

  // Calculate divisors for a given range
  const calculateDivisors = (range: number): number[] => {
    if (range === 0) return [];

    const divisors: number[] = [];
    for (let i = 2; i <= range; i++) {
      if (range % i === 0) {
        divisors.push(i);
      }
    }
    return divisors;
  };

  // Handle angle range change with symmetric behavior
  const handleAngleRangeChange = (
    event: Event,
    newValue: number | number[]
  ) => {
    const [newStart, newEnd] = newValue as [number, number];

    // Determine which thumb moved by comparing with current values
    const [currentStart, currentEnd] = angleRange;

    let symmetricRange: [number, number];

    if (newStart !== currentStart) {
      // Left thumb moved, mirror it to the right
      symmetricRange = [newStart, -newStart];
    } else if (newEnd !== currentEnd) {
      // Right thumb moved, mirror it to the left
      symmetricRange = [-newEnd, newEnd];
    } else {
      // No change or both changed somehow
      symmetricRange = [newStart, newEnd];
    }

    // Ensure the range is valid (start <= end)
    if (symmetricRange[0] > symmetricRange[1]) {
      symmetricRange = [symmetricRange[1], symmetricRange[0]];
    }

    setAngleRange(symmetricRange);

    // Calculate new divisors
    const range = Math.abs(symmetricRange[1] - symmetricRange[0]);
    const divisors = calculateDivisors(range);
    setAvailableDivisors(divisors);

    // Reset divisor to 2 if available, otherwise first available divisor
    if (divisors.length > 0) {
      setSelectedDivisor(divisors.includes(2) ? 2 : divisors[0]);
    }
  };

  const handleWindowRangeChange = (
    event: Event,
    newValue: number | number[]
  ) => {
    let [newStart, newEnd] = newValue as [number, number];

    // Ensure even numbers
    newStart = newStart % 2 === 0 ? newStart : newStart + 1;
    newEnd = newEnd % 2 === 0 ? newEnd : newEnd + 1;

    // Ensure endUs > startUs by at least 2

    if (newStart > 190) newStart = 190;
    if (newEnd <= newStart + 10) newEnd = newStart + 10;

    // Ensure within bounds
    newStart = Math.max(20, Math.min(198, newStart));
    newEnd = Math.max(newStart + 2, Math.min(200, newEnd));

    updateConfig({ startUs: newStart, endUs: newEnd });
  };

  const LabelCell = ({ label }: { label: string }) => (
    <TableCell sx={{ width: '20%', verticalAlign: 'middle', pr: 3 }}>
      <Typography
        variant="subtitle2"
        color="text.secondary"
        fontWeight="medium"
      >
        {`${label}`}
      </Typography>
    </TableCell>
  );

  return (
    <Paper
      elevation={1}
      sx={{
        p: 3,
        mb: 4,
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" color="text.secondary" fontWeight="medium">
          Scan Configuration
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={resetConfig}
          >
            Reset
          </Button>
          <Button variant="contained" onClick={() => {}}>
            Unused
          </Button>
        </Stack>
      </Box>

      {/* Compact Form Layout */}
      <Table sx={{ '& td': { border: 0, py: 1.5 } }}>
        <TableBody>
          {/* Angles Row */}
          <TableRow sx={tableRowSx}>
            <LabelCell label="Angles" />
            <TableCell sx={{ width: '60%', verticalAlign: 'bottom' }}>
              <Slider
                value={angleRange}
                onChange={handleAngleRangeChange}
                min={-45}
                max={45}
                step={1}
                marks={[
                  { value: -45, label: '-45°' },
                  { value: 0, label: '0°' },
                  { value: 45, label: '45°' },
                ]}
                valueLabelDisplay="on"
                valueLabelFormat={value => `${value}°`}
                size="small"
                sx={iosStyleEx}
              />
            </TableCell>
            <TableCell sx={{ width: '20%', pl: 2 }}>
              <Select
                variant="standard"
                value={selectedDivisor}
                onChange={e => setSelectedDivisor(e.target.value as number)}
                size="small"
                disabled={availableDivisors.length === 0}
                sx={{ minWidth: 120 }}
                displayEmpty
              >
                {availableDivisors.length === 0 ? (
                  <MenuItem value={2} disabled>
                    -
                  </MenuItem>
                ) : (
                  availableDivisors.map(divisor => (
                    <MenuItem key={divisor} value={divisor}>
                      {divisor} parts
                    </MenuItem>
                  ))
                )}
              </Select>
            </TableCell>
          </TableRow>

          {/* Steps Row */}
          <TableRow sx={tableRowSx}>
            <LabelCell label="Steps" />
            <TableCell colSpan={1} sx={{ verticalAlign: 'bottom' }}>
              <Slider
                value={steps}
                onChange={(_, value) => setSteps(value as number)}
                min={1}
                max={32}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 32, label: '32' },
                ]}
                valueLabelDisplay="on"
                size="small"
                sx={iosStyleEx}
              />
            </TableCell>
          </TableRow>

          {/* Pattern Row */}
          <TableRow sx={tableRowSx}>
            <LabelCell label="Pattern" />
            <TableCell>
              <PatternControl
                units={patternUnits}
                onUnitsChange={newUnits => setPatternUnits(newUnits)}
              />
            </TableCell>
          </TableRow>

          {/* Repeat Row */}
          <TableRow sx={tableRowSx}>
            <LabelCell label="Repeat" />
            <TableCell sx={{ verticalAlign: 'bottom' }}>
              <Slider
                value={config.repeat}
                onChange={(_, value) =>
                  updateConfig({ repeat: value as number })
                }
                min={1}
                max={31}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 31, label: '31' },
                ]}
                valueLabelDisplay="on"
                size="small"
                sx={iosStyleEx}
              />
            </TableCell>
          </TableRow>

          {/* Tail Row */}
          <TableRow sx={tableRowSx}>
            <LabelCell label="Tail" />
            <TableCell sx={{ verticalAlign: 'bottom' }}>
              <Slider
                value={config.tail}
                onChange={(_, value) => updateConfig({ tail: value as number })}
                min={2}
                max={32}
                step={1}
                marks={[
                  { value: 2, label: '2' },
                  { value: 32, label: '32' },
                ]}
                valueLabelDisplay="on"
                size="small"
                sx={iosStyleEx}
              />
            </TableCell>
          </TableRow>

          {/* Window Row */}
          <TableRow sx={tableRowSx}>
            <LabelCell label="Window" />
            <TableCell>
              <Slider
                value={[config.startUs, config.endUs]}
                onChange={handleWindowRangeChange}
                min={20}
                max={200}
                step={2}
                marks={[
                  { value: 20, label: '20μs' },
                  { value: 200, label: '200μs' },
                ]}
                valueLabelDisplay="on"
                valueLabelFormat={value => `${value}μs`}
                size="small"
                sx={iosStyleEx}
                disableSwap
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  );
};

export default UltrasonicControlPanel;
