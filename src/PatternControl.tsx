import React, { useState, useCallback } from 'react';

import { useTheme } from '@mui/material/styles';

import {
  Box,
  FormControl,
  FormLabel,
  Popover,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

// Pattern unit configuration
export interface PatternUnit {
  range: number;
  position: 'top' | 'middle' | 'bottom' | 'none';
}

// PatternControl Component Props
export interface PatternControlProps {
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

export default PatternControl;
