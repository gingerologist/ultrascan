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
  Popover,
  ToggleButton,
  ToggleButtonGroup,
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

// Pattern unit configuration
interface PatternUnit {
  range: number;
  position: 'top' | 'middle' | 'bottom' | 'none';
}

// PatternControl Component Props
interface PatternControlProps {
  units: PatternUnit[];
  onUnitsChange: (units: PatternUnit[]) => void;
  error?: string;
  onErrorChange?: (error: string) => void;
}

// Standalone Pattern Control Component
const PatternControl: React.FC<PatternControlProps> = ({
  units,
  onUnitsChange,
  error,
  onErrorChange,
}) => {
  const theme = useTheme();
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [activeUnitIndex, setActiveUnitIndex] = useState<number>(-1);

  // Handle pattern unit click
  const handleUnitClick = (
    event: React.MouseEvent<HTMLElement>,
    index: number
  ) => {
    setPopoverAnchor(event.currentTarget);
    setActiveUnitIndex(index);
  };

  // Handle popover close
  const handlePopoverClose = () => {
    setPopoverAnchor(null);
    setActiveUnitIndex(-1);
  };

  // Update pattern unit
  const updatePatternUnit = (index: number, updates: Partial<PatternUnit>) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], ...updates };
    onUnitsChange(newUnits);

    // Clear error when user makes changes
    if (error && onErrorChange) {
      onErrorChange('');
    }
  };

  // Render a single pattern unit (3 squares)
  const renderPatternUnit = (unit: PatternUnit, index: number) => {
    // Check if this unit should be disabled (after any 'none' unit)
    const isDisabled = units.slice(0, index).some(u => u.position === 'none');

    const getSquareStyle = (position: 'top' | 'middle' | 'bottom') => {
      const baseStyle = {
        width: 30,
        height: 12,
        backgroundColor: isDisabled
          ? theme.palette.grey[100]
          : theme.palette.grey[200],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 'bold',
        color: theme.palette.text.primary,
      };

      // Add thick top border if this position is selected
      if (unit.position === position && !isDisabled) {
        return {
          ...baseStyle,
          borderTop: `3px solid ${theme.palette.primary.main}`,
        };
      }

      return baseStyle;
    };

    return (
      <Box
        key={index}
        onClick={isDisabled ? undefined : e => handleUnitClick(e, index)}
        sx={{
          width: 30,
          height: 36,
          cursor: isDisabled ? 'default' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          opacity: isDisabled ? 0.3 : 1,
          '&:hover': {
            opacity: isDisabled ? 0.3 : 0.7,
          },
        }}
      >
        {/* Top Square */}
        <Box sx={getSquareStyle('top')} />

        {/* Middle Square */}
        <Box sx={getSquareStyle('middle')} />

        {/* Bottom Square - shows the range number */}
        <Box sx={getSquareStyle('bottom')}>
          {!isDisabled && unit.position !== 'none' ? unit.range : ''}
        </Box>
      </Box>
    );
  };

  return (
    <>
      <Box display="flex" flexWrap="wrap" gap={0}>
        {units.map((unit, index) => renderPatternUnit(unit, index))}
      </Box>

      {/* Pattern Configuration Popover */}
      <Popover
        open={Boolean(popoverAnchor)}
        anchorEl={popoverAnchor}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 3, minWidth: 280 }}>
          {activeUnitIndex >= 0 && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Configure Unit {activeUnitIndex + 1}
              </Typography>

              {/* Range Slider */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <FormLabel>
                  Range:{' '}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      minWidth: '20px',
                      textAlign: 'right',
                    }}
                  >
                    {units[activeUnitIndex]?.range}
                  </Box>
                </FormLabel>
                <Slider
                  value={units[activeUnitIndex]?.range || 2}
                  onChange={(_, value) =>
                    updatePatternUnit(activeUnitIndex, {
                      range: value as number,
                    })
                  }
                  min={2}
                  max={32}
                  step={1}
                  marks={[
                    { value: 2, label: '2' },
                    { value: 32, label: '32' },
                  ]}
                  valueLabelDisplay="auto"
                  size="small"
                  sx={{ mt: 2 }}
                />
              </FormControl>

              {/* Position Toggle Buttons */}
              <FormControl fullWidth>
                <FormLabel>Position</FormLabel>
                <ToggleButtonGroup
                  value={units[activeUnitIndex]?.position}
                  exclusive
                  onChange={(_, newValue) => {
                    if (newValue !== null) {
                      updatePatternUnit(activeUnitIndex, {
                        position: newValue,
                      });
                    }
                  }}
                  sx={{ mt: 1 }}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="top">Top</ToggleButton>
                  <ToggleButton value="middle">Middle</ToggleButton>
                  <ToggleButton value="bottom">Bottom</ToggleButton>
                  {/* Only show 'None' option if not the first segment (index 0) */}
                  {activeUnitIndex > 0 && (
                    <ToggleButton value="none">None</ToggleButton>
                  )}
                </ToggleButtonGroup>
              </FormControl>
            </>
          )}
        </Box>
      </Popover>
    </>
  );
};

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

  // Pattern management - 16 custom units
  const [patternUnits, setPatternUnits] = useState<PatternUnit[]>(() => {
    // Initialize with first unit as 'top' and rest as 'none'
    return Array(16)
      .fill(null)
      .map((_, index) =>
        index === 0
          ? { range: 2, position: 'top' as const }
          : { range: 2, position: 'none' as const }
      );
  });
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [activeUnitIndex, setActiveUnitIndex] = useState<number>(-1);

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

  // Handle pattern unit click
  const handleUnitClick = (
    event: React.MouseEvent<HTMLElement>,
    index: number
  ) => {
    setPopoverAnchor(event.currentTarget);
    setActiveUnitIndex(index);
  };

  // Handle popover close
  const handlePopoverClose = () => {
    setPopoverAnchor(null);
    setActiveUnitIndex(-1);
  };

  // Update pattern unit
  const updatePatternUnit = (index: number, updates: Partial<PatternUnit>) => {
    const newUnits = [...patternUnits];
    newUnits[index] = { ...newUnits[index], ...updates };
    setPatternUnits(newUnits);
  };

  // Render a single pattern unit (3 squares)
  const renderPatternUnit = (unit: PatternUnit, index: number) => {
    // Check if this unit should be disabled (after any 'none' unit)
    const isDisabled = patternUnits
      .slice(0, index)
      .some(u => u.position === 'none');

    const getSquareStyle = (position: 'top' | 'middle' | 'bottom') => {
      const baseStyle = {
        width: 30,
        height: 12,
        backgroundColor: isDisabled
          ? theme.palette.grey[100]
          : theme.palette.grey[200],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 'bold',
        color: theme.palette.text.primary,
      };

      // Add thick top border if this position is selected
      if (unit.position === position && !isDisabled) {
        return {
          ...baseStyle,
          borderTop: `3px solid ${theme.palette.primary.main}`,
        };
      }

      return baseStyle;
    };

    return (
      <Box
        key={index}
        onClick={isDisabled ? undefined : e => handleUnitClick(e, index)}
        sx={{
          width: 30,
          height: 36,
          cursor: isDisabled ? 'default' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          opacity: isDisabled ? 0.3 : 1,
          '&:hover': {
            opacity: isDisabled ? 0.3 : 0.7,
          },
        }}
      >
        {/* Top Square */}
        <Box sx={getSquareStyle('top')} />

        {/* Middle Square */}
        <Box sx={getSquareStyle('middle')} />

        {/* Bottom Square - shows the range number */}
        <Box sx={getSquareStyle('bottom')}>
          {!isDisabled && unit.position !== 'none' ? unit.range : ''}
        </Box>
      </Box>
    );
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
    if (newEnd <= newStart) {
      newEnd = newStart + 2;
    }

    // Ensure within bounds
    newStart = Math.max(20, Math.min(198, newStart));
    newEnd = Math.max(newStart + 2, Math.min(200, newEnd));

    updateConfig({ startUs: newStart, endUs: newEnd });
  };

  const generateConfig = () => {
    // Validate pattern units - at least one should be configured
    const hasConfiguredUnits = patternUnits.some(
      unit => unit.position !== 'none'
    );
    if (!hasConfiguredUnits) {
      setPatternError('At least one pattern unit must be configured');
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
    // Reset first unit to 'top' instead of 'none' since first segment cannot be 'none'
    const resetUnits = Array(16)
      .fill(null)
      .map((_, index) =>
        index === 0
          ? { range: 2, position: 'top' as const }
          : { range: 2, position: 'none' as const }
      );
    setPatternUnits(resetUnits);
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
              <Box display="flex" flexWrap="wrap" gap={0}>
                {patternUnits.map((unit, index) =>
                  renderPatternUnit(unit, index)
                )}
              </Box>

              {/* Pattern Configuration Popover */}
              <Popover
                open={Boolean(popoverAnchor)}
                anchorEl={popoverAnchor}
                onClose={handlePopoverClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'center',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'center',
                }}
              >
                <Box sx={{ p: 3, minWidth: 280 }}>
                  {activeUnitIndex >= 0 && (
                    <>
                      <Typography variant="subtitle2" gutterBottom>
                        Configure Unit {activeUnitIndex + 1}
                      </Typography>

                      {/* Range Slider */}
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <FormLabel>
                          Range:{' '}
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              minWidth: '20px',
                              textAlign: 'right',
                            }}
                          >
                            {patternUnits[activeUnitIndex]?.range}
                          </Box>
                        </FormLabel>
                        <Slider
                          value={patternUnits[activeUnitIndex]?.range || 2}
                          onChange={(_, value) =>
                            updatePatternUnit(activeUnitIndex, {
                              range: value as number,
                            })
                          }
                          min={2}
                          max={32}
                          step={1}
                          marks={[
                            { value: 2, label: '2' },
                            { value: 32, label: '32' },
                          ]}
                          valueLabelDisplay="auto"
                          size="small"
                          sx={{ mt: 2 }}
                        />
                      </FormControl>

                      {/* Position Toggle Buttons */}
                      <FormControl fullWidth>
                        <FormLabel>Position</FormLabel>
                        <ToggleButtonGroup
                          value={patternUnits[activeUnitIndex]?.position}
                          exclusive
                          onChange={(_, newValue) => {
                            if (newValue !== null) {
                              updatePatternUnit(activeUnitIndex, {
                                position: newValue,
                              });
                            }
                          }}
                          sx={{ mt: 1 }}
                          size="small"
                          fullWidth
                        >
                          <ToggleButton value="top">Top</ToggleButton>
                          <ToggleButton value="middle">Middle</ToggleButton>
                          <ToggleButton value="bottom">Bottom</ToggleButton>
                          {/* Only show 'None' option if not the first segment (index 0) */}
                          {activeUnitIndex > 0 && (
                            <ToggleButton value="none">None</ToggleButton>
                          )}
                        </ToggleButtonGroup>
                      </FormControl>
                    </>
                  )}
                </Box>
              </Popover>
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
