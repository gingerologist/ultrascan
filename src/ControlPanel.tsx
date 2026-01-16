import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  Slider,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';

// import {
//   ContentCopy as CopyIcon,
//   Refresh as RefreshIcon,
// } from '@mui/icons-material';

import { useTheme, SxProps } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

import PatternControl from './PatternControl';
import RxApodizationTable from './RxApodizationTable';
import TxApodization from './TxApodization';

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
  pattern: JsonPatternSegment[];
  repeat: number;
  tail: number;
  startUs: number;
  endUs: number;
  txApodization: number[][];
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

const DEFAULTS = {
  angleRange: [0, 0] as [number, number],
  committedAngleRange: [0, 0] as [number, number],
  selectedDivisor: 1,
  steps: 1,

  startUs: 40,
  endUs: 80,
  repeat: 1,
  tail: 5,
  version: '1.0',
  name: 'noname',
  pattern: [
    [5, 2],
    [5, 1],
  ] as JsonPatternSegment[],
  rxApodization: Array.from({ length: 64 }, (_, i) => i),
  txApodization: Array.from({ length: 8 }, () => Array.from({ length: 32 }, () => 0)),
};

const calculateDivisors = (range: number): number[] => {
  const divisors: number[] = [1]; // Always include 1 as a valid divisor

  if (range === 0) return divisors; // Only return [1] for zero range

  for (let i = 2; i <= range; i++) {
    if (range % i === 0) divisors.push(i);
  }
  return divisors;
};

// Calculate masks for ultrasonic channels based on steps
const calculateMasks = (steps: number): number[] => {
  const masks: number[] = [];

  if (steps === 1) {
    // All channels [0..31] allowed (all bits 0)
    return [0x00000000];
  }

  // Calculate the number of channels per step
  const channelsPerStep = 32 - steps + 1;

  for (let step = 0; step < steps; step++) {
    let mask = 0xffffffff; // Start with all bits set (all channels powered down)

    // For step i, enable channels [i..i+channelsPerStep-1]
    const startChannel = step;
    const endChannel = step + channelsPerStep - 1;

    // Clear bits for channels that should be powered on (bit 0 = allowed)
    for (let channel = startChannel; channel <= endChannel; channel++) {
      mask &= ~(1 << channel);
    }

    masks.push(mask >>> 0); // Ensure unsigned 32-bit integer
  }

  return masks;
};

const calculateAngles = (
  committedAngleRange: [number, number],
  selectedDivisor: number,
  steps: number
): JsonAngle[] => {
  const [start, end] = committedAngleRange;
  const range = Math.abs(end - start);
  const angles: JsonAngle[] = [];
  const masks = calculateMasks(steps);

  if (range === 0) {
    // Only one angle when range is 0
    angles.push({
      degree: start,
      masks,
    });
  } else {
    const divisor = selectedDivisor;
    const stepSize = range / divisor;
    for (let i = 0; i <= divisor; i++) {
      const degree = start + i * stepSize;
      angles.push({
        degree: Math.round(degree * 100) / 100,
        masks: masks,
      });
    }
  }

  return angles;
};

interface ControlPanelProps {
  // this register function returns a unregister function
  // which will be used when current React component is unmounted.
  // this is how useEffect hooks work.
  registerResetConfigHandler: (handler: () => void) => () => void;

  // this register function works in a way similar to resetConfig
  // it differs in that the handler return a config
  registerApplyConfigHandler: (handler: () => JsonConfig) => () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  registerResetConfigHandler,
  registerApplyConfigHandler,
}) => {
  const theme = useTheme();
  const iosStyleEx: SxProps = getIOSSliderStyleEx(theme);
  const tableRowSx: SxProps = { height: 136 };
  const rxApodizationRowSx: SxProps = { minHeight: 136, height: 'auto' };

  const [startUs, setStartUs] = useState(DEFAULTS.startUs);
  const [endUs, setEndUs] = useState(DEFAULTS.endUs);
  const [repeat, setRepeat] = useState(DEFAULTS.repeat);
  const [tail, setTail] = useState(DEFAULTS.tail);

  const [pattern, setPattern] = useState<JsonPatternSegment[]>(
    DEFAULTS.pattern
  );

  const [angleRange, setAngleRange] = useState<[number, number]>(
    DEFAULTS.angleRange
  );
  const [committedAngleRange, setCommittedAngleRange] = useState<
    [number, number]
  >(DEFAULTS.committedAngleRange);
  const [selectedDivisor, setSelectedDivisor] = useState(
    DEFAULTS.selectedDivisor
  );
  const [steps, setSteps] = useState(DEFAULTS.steps);
  const [rxApodization, setRxApodization] = useState<number[]>(
    DEFAULTS.rxApodization
  );
  const [txApodization, setTxApodization] = useState<number[][]>(
    DEFAULTS.txApodization
  );

  const startUsRef = useRef(startUs);
  useEffect(() => {
    startUsRef.current = startUs;
  }, [startUs]);

  const endUsRef = useRef(endUs);
  useEffect(() => {
    endUsRef.current = endUs;
  }, [endUs]);

  const repeatRef = useRef(repeat);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const tailRef = useRef(tail);
  useEffect(() => {
    tailRef.current = tail;
  }, [tail]);

  const patternRef = useRef(pattern);
  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  const committedAngleRangeRef = useRef(committedAngleRange);
  useEffect(() => {
    committedAngleRangeRef.current = committedAngleRange;
  }, [committedAngleRange]);

  const selectedDivisorRef = useRef(selectedDivisor);
  useEffect(() => {
    selectedDivisorRef.current = selectedDivisor;
  }, [selectedDivisor]);

  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const rxApodizationRef = useRef(rxApodization);
  useEffect(() => {
    rxApodizationRef.current = rxApodization;
  }, [rxApodization]);

  const txApodizationRef = useRef(txApodization);
  useEffect(() => {
    txApodizationRef.current = txApodization;
  }, [txApodization]);

  const availableDivisors = useMemo(() => {
    const range = Math.abs(committedAngleRange[1] - committedAngleRange[0]);
    return calculateDivisors(range);
  }, [committedAngleRange]);

  useEffect(() => {
    return registerResetConfigHandler(() => {
      setStartUs(DEFAULTS.startUs);
      setEndUs(DEFAULTS.endUs);
      setRepeat(DEFAULTS.repeat);
      setTail(DEFAULTS.tail);
      setPattern(DEFAULTS.pattern);
      setAngleRange(DEFAULTS.angleRange);
      setCommittedAngleRange(DEFAULTS.committedAngleRange);
      setSelectedDivisor(DEFAULTS.selectedDivisor);
      setSteps(DEFAULTS.steps);
      setRxApodization(DEFAULTS.rxApodization);
      setTxApodization(DEFAULTS.txApodization);
    });
  }, []);

  // Handle rxApodization checkbox toggle
  const handleRxApodizationToggle = (channelIndex: number) => {
    setRxApodization(prev => {
      const newSelected = prev.includes(channelIndex)
        ? prev.filter(idx => idx !== channelIndex)
        : [...prev, channelIndex].sort((a, b) => a - b);
      return newSelected;
    });
  };

  useEffect(() => {
    return registerApplyConfigHandler(() => {
      const config = {
        version: DEFAULTS.version,
        name: DEFAULTS.name,
        angles: calculateAngles(
          committedAngleRangeRef.current,
          selectedDivisorRef.current,
          stepsRef.current
        ),
        pattern: patternRef.current,
        repeat: repeatRef.current,
        tail: tailRef.current,
        startUs: startUsRef.current,
        endUs: endUsRef.current,
        txApodization: txApodizationRef.current,
      };

      console.log(config);
      return config;
    });
  }, []);

  // Handle visual update during dragging (no calculations)
  const handleAngleRangeVisualChange = (
    event: Event,
    newValue: number | number[]
  ) => {
    const [newStart, newEnd] = newValue as [number, number];
    setAngleRange([newStart, newEnd]);
  };

  // Handle angle range change - only called when user releases the thumb
  const handleAngleRangeChange = (
    event: Event,
    newValue: number | number[]
  ) => {
    const [newStart, newEnd] = newValue as [number, number];

    // Update both visual and committed values
    setAngleRange([newStart, newEnd]);
    setCommittedAngleRange([newStart, newEnd]);

    // Calculate new divisors based on the range (regardless of symmetry)
    const range = Math.abs(newEnd - newStart);
    const divisors = calculateDivisors(range);

    setSelectedDivisor(divisors.includes(1) ? 1 : divisors[0]);
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
    <Box mt={2}>
      {/* Compact Form Layout */}
      <Table sx={{ '& td': { border: 0, py: 1.5 } }}>
        <TableBody>
          {/* Angles Row */}
          <TableRow sx={tableRowSx}>
            <LabelCell label="Angles" />
            <TableCell sx={{ width: '60%', verticalAlign: 'bottom' }}>
              <Slider
                value={angleRange}
                onChange={handleAngleRangeVisualChange}
                onChangeCommitted={handleAngleRangeChange}
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
                {availableDivisors.map(divisor => (
                  <MenuItem key={divisor} value={divisor}>
                    {(() => {
                      const range = Math.abs(
                        committedAngleRange[1] - committedAngleRange[0]
                      );
                      return range === 0 ? '1 angle' : `${divisor + 1} angles`;
                    })()}
                  </MenuItem>
                ))}
              </Select>
            </TableCell>
          </TableRow>

          {/* Calculated Angles Display Row */}
          <TableRow>
            <TableCell />
            <TableCell colSpan={2} sx={{ py: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Calculated angles:</strong>{' '}
                {(() => {
                  const [start, end] = committedAngleRange;
                  const range = Math.abs(end - start);
                  const angles: number[] = [];

                  if (range === 0) {
                    angles.push(start); // Only one angle when range is 0
                  } else {
                    const stepSize = range / selectedDivisor;
                    for (let i = 0; i <= selectedDivisor; i++) {
                      const degree = start + i * stepSize;
                      angles.push(Math.round(degree * 100) / 100);
                    }
                  }

                  return angles.map(angle => `${angle}°`).join(', ');
                })()}
              </Typography>
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
                pattern={pattern}
                onPatternChange={newPattern => setPattern(newPattern)}
              />
            </TableCell>
          </TableRow>

          {/* Repeat Row */}
          <TableRow sx={tableRowSx}>
            <LabelCell label="Repeat" />
            <TableCell sx={{ verticalAlign: 'bottom' }}>
              <Slider
                value={repeat}
                onChange={(_, value) => setRepeat(value as number)}
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
                value={tail}
                onChange={(_, value) => setTail(value as number)}
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
                value={[startUs, endUs]}
                onChange={(_, value: number | number[]) => {
                  const [start, end] = value as [number, number];
                  setStartUs(start);
                  setEndUs(end);
                }}
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
          <TableRow sx={rxApodizationRowSx}>
            {/* tx Apodization Control */}
            <LabelCell label="TX Apodization" />
            <TableCell colSpan={2} sx={{ verticalAlign: 'top', pt: 2 }}>
              <Box sx={{ mt: 0, mb: 1 }}>
                <Box sx={{ pl: 0 }}>
                  <TxApodization
                    txApodization={txApodization}
                    setTxApodization={setTxApodization}
                  />
                </Box>
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={rxApodizationRowSx}>
            {/* rx Apodization Control */}
            <LabelCell label="RX Apodization" />
            <TableCell colSpan={2} sx={{ verticalAlign: 'top', pt: 2 }}>
              <Box sx={{ mt: 0, mb: 1 }}>
                <Box sx={{ pl: 0 }}>
                  <RxApodizationTable
                    rxApodization={rxApodization}
                    setRxApodization={setRxApodization}
                    defaults={{ rxApodization: DEFAULTS.rxApodization }}
                  />
                </Box>
              </Box>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
};

export default ControlPanel;
