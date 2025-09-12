import React from 'react';
import { LinearProgress, Typography } from '@mui/material';

const FractionProgress = ({ num = 0, denom = -1 }) => {
  // Determine progress mode and value
  const getProgressProps = () => {
    if (denom === 0) {
      // Indeterminate mode when denominator is 0
      return { mode: 'indeterminate' };
    } else if (denom > 0) {
      // Determinate mode when denominator is positive
      const value = Math.min(Math.max((num / denom) * 100, 0), 100);
      return { mode: 'determinate', value };
    }
    // For denom === -1 or other negative values
    return { mode: 'hidden' };
  };

  const { mode, value } = getProgressProps();

  // Styles
  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minWidth: '200px',
    height: '24px',
  };

  const labelStyle = {
    width: '80px',
    flexShrink: 0,
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#333',
  };

  const progressContainerStyle = {
    width: '120px',
    marginLeft: '16px',
    height: '4px',
    backgroundColor: '#e0e0e0',
    borderRadius: '2px',
    overflow: 'hidden',
    position: 'relative',
  };

  const progressBarStyle = {
    height: '100%',
    backgroundColor: '#1976d2',
    borderRadius: '2px',
    transition: 'transform 0.3s ease',
  };

  const indeterminateStyle = {
    ...progressBarStyle,
    width: '30%',
    animation: 'indeterminate 2s infinite linear',
    transformOrigin: 'left',
  };

  const determinateStyle = {
    ...progressBarStyle,
    width: `${value}%`,
  };

  return (
    <>
      <div style={containerStyle}>
        {/* Text label with fixed width */}
        <div style={labelStyle}>{denom !== -1 && `${num}/${denom}`}</div>

        {/* Progress bar with fixed width */}
        {denom !== -1 && (
          <LinearProgress
            variant={denom === 0 ? 'indeterminate' : 'determinate'}
          />
        )}
      </div>
    </>
  );
};

export default FractionProgress;
