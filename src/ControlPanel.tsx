import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Grid,
  FormControl,
  FormLabel,
  TextField,
  Select,
  MenuItem,
  Slider,
  Alert,
  AlertTitle,
  Chip,
  Divider,
  IconButton,
  Card,
  CardContent,
  useTheme,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// Type definitions matching your schema
interface JsonAngle {
  degree: number;
  masks: number[];
}

type JsonPatternSegment = [number, number]; // [duration, level]
type CharPatternLevel = 'F' | 'M' | 'P' | 'G';

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

const seg32: string[] = new Array(32).fill(0).map((x, i) => i.toString());

const UltrasonicControlPanel: React.FC<ControlPanelProps> = ({
  onConfigChange,
}) => {
  const theme = useTheme();

  const [config, setConfig] = useState<JsonConfig>({
    version: '1.0',
    name: '',
    angles: [],
    patterns: [],
    repeat: 1,
    tail: 2,
    txStartDel: -1,
    startUs: 20,
    endUs: 22,
  });

  const [jsonOutput, setJsonOutput] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [patternError, setPatternError] = useState<string>('');

  // Pattern management - simplified to just text input
  const [patternText, setPatternText] = useState('');

  // Angle management - new approach with range slider and divisor
  const [angleRange, setAngleRange] = useState<[number, number]>([0, 0]);
  const [selectedDivisor, setSelectedDivisor] = useState(2);
  const [availableDivisors, setAvailableDivisors] = useState<number[]>([]);

  // Steps control
  const [steps, setSteps] = useState(1);

  const levelMap: Record<CharPatternLevel, number> = {
    F: 0, // Float
    M: 1, // Minus (negative)
    P: 2, // Positive
    G: 3, // Ground
  };

  const levelDisplayMap: Record<number, string> = {
    0: 'F (Float)',
    1: 'M (Minus)',
    2: 'P (Positive)',
    3: 'G (Ground)',
  };

  // Generate default mask (all zeros for simplicity)
  const generateDefaultMask = () => {
    return new Array(32).fill(0);
  };

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

  // Handle window range change with even number constraint
  const handleWindowRangeChange = (
    event: Event,
    newValue: number | number[]
  ) => {
    let [newStart, newEnd] = newValue as [number, number];

    // Ensure even numbers
    newStart = newStart % 2 === 0 ? newStart : newStart + 1;
    newEnd = newEnd % 2 === 0 ? newEnd : newEnd + 1;

    // Ensure endUs > startUs by at least 2
    if (newEnd <= newStart) {
      newEnd = newStart + 2;
    }

    // Ensure within bounds
    newStart = Math.max(20, Math.min(198, newStart));
    newEnd = Math.max(newStart + 2, Math.min(200, newEnd));

    updateConfig({ startUs: newStart, endUs: newEnd });
  };

  const generateConfig = () => {
    // Basic pattern validation
    if (!patternText.trim()) {
      setPatternError('Pattern text is required');
      return;
    }
    setPatternError('');

    const jsonString = JSON.stringify(config, null, 2);
    setJsonOutput(jsonString);
    setShowJson(true);
  };

  const resetConfig = () => {
    const defaultConfig: JsonConfig = {
      version: '1.0',
      name: '',
      angles: [],
      patterns: [],
      repeat: 1,
      tail: 2,
      txStartDel: -1,
      startUs: 20,
      endUs: 22,
    };
    setConfig(defaultConfig);
    setJsonOutput('');
    setShowJson(false);
    setPatternError('');
    setPatternText('');
    setAngleRange([0, 0]);
    setSelectedDivisor(2);
    setAvailableDivisors([]);
    setSteps(1);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonOutput);
      // TODO: Add toast notification
    } catch (err) {
      // TODO: Add toast notification
    }
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        mb: 4,
        border: '2px solid',
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
          <Button variant="contained" onClick={generateConfig}>
            Generate JSON
          </Button>
        </Stack>
      </Box>

      {/* Compact Form Layout */}
      <Table sx={{ '& td': { border: 0, py: 1.5 } }}>
        <TableBody>
          {/* Angles Row */}
          <TableRow>
            <TableCell sx={{ width: '20%', verticalAlign: 'top', pr: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                fontWeight="medium"
              >
                Angles
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {angleRange[0] === angleRange[1]
                  ? `Single: ${angleRange[0]}°`
                  : `${angleRange[0]}° to ${angleRange[1]}°`}
              </Typography>
            </TableCell>
            <TableCell sx={{ width: '50%' }}>
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
                valueLabelDisplay="auto"
                valueLabelFormat={value => `${value}°`}
                size="small"
              />
            </TableCell>
            <TableCell sx={{ width: '30%', pl: 2 }}>
              <Select
                value={selectedDivisor}
                onChange={e => setSelectedDivisor(e.target.value as number)}
                size="small"
                disabled={availableDivisors.length === 0}
                sx={{ minWidth: 120 }}
                displayEmpty
              >
                {availableDivisors.length === 0 ? (
                  <MenuItem value={2} disabled>
                    No divisions
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
          <TableRow>
            <TableCell sx={{ verticalAlign: 'top', pr: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                fontWeight="medium"
              >
                Steps
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {steps}
              </Typography>
            </TableCell>
            <TableCell colSpan={2}>
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
                valueLabelDisplay="auto"
                size="small"
              />
            </TableCell>
          </TableRow>

          {/* Pattern Row */}
          <TableRow>
            <TableCell sx={{ verticalAlign: 'top', pr: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                fontWeight="medium"
              >
                Pattern
              </Typography>
              {patternError && (
                <Typography variant="caption" color="error.main">
                  {patternError}
                </Typography>
              )}
            </TableCell>
            <TableCell colSpan={2}>
              <TextField
                fullWidth
                size="small"
                value={patternText}
                onChange={e => {
                  setPatternText(e.target.value);
                  if (patternError) setPatternError('');
                }}
                placeholder="Enter pattern text here..."
                error={!!patternError}
              />
            </TableCell>
          </TableRow>

          {/* Repeat Row */}
          <TableRow>
            <TableCell sx={{ verticalAlign: 'top', pr: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                fontWeight="medium"
              >
                Repeat
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {config.repeat}
              </Typography>
            </TableCell>
            <TableCell colSpan={2}>
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
                valueLabelDisplay="auto"
                size="small"
              />
            </TableCell>
          </TableRow>

          {/* Tail Row */}
          <TableRow>
            <TableCell sx={{ verticalAlign: 'top', pr: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                fontWeight="medium"
              >
                Tail
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {config.tail}
              </Typography>
            </TableCell>
            <TableCell colSpan={2}>
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
                valueLabelDisplay="auto"
                size="small"
              />
            </TableCell>
          </TableRow>

          {/* Window Row */}
          <TableRow>
            <TableCell sx={{ verticalAlign: 'top', pr: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                fontWeight="medium"
              >
                Window
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {config.startUs}μs - {config.endUs}μs
              </Typography>
            </TableCell>
            <TableCell colSpan={2}>
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
                valueLabelDisplay="auto"
                valueLabelFormat={value => `${value}μs`}
                size="small"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {/* JSON Output Section */}
      {showJson && (
        <Box mt={3}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: 'grey.50',
            }}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Configuration JSON
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<CopyIcon />}
                onClick={copyToClipboard}
              >
                Copy
              </Button>
            </Box>
            <Paper
              sx={{
                p: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'grey.300',
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              <Typography
                component="pre"
                variant="body2"
                fontFamily="monospace"
                sx={{ whiteSpace: 'pre-wrap', margin: 0 }}
              >
                {jsonOutput}
              </Typography>
            </Paper>
          </Paper>
        </Box>
      )}
    </Paper>
  );
};

export default UltrasonicControlPanel;
