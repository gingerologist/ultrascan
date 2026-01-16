import React from 'react';
import { Box } from '@mui/material';

// Props interface for the TxApodization component
interface TxApodizationProps {
  txApodization: number[][];
  setTxApodization: React.Dispatch<React.SetStateAction<number[][]>>;
}

// Custom TxApodization Table Component (8 rows × 33 columns)
const TxApodization: React.FC<TxApodizationProps> = ({
  txApodization,
  setTxApodization,
}) => {
  // Table dimensions
  const ROWS = 8;
  const COLS = 33;

  // Handle table cell click
  const handleCellClick = (row: number, col: number) => {
    if (col === 0) {
      // First column: Select/deselect entire row
      const isRowSelected = txApodization[row].length === 32;

      if (isRowSelected) {
        // Deselect entire row
        setTxApodization(prev => {
          const newState = [...prev];
          newState[row] = [];
          return newState;
        });
      } else {
        // Select entire row (fill with 0-31)
        setTxApodization(prev => {
          const newState = [...prev];
          newState[row] = Array.from({ length: 32 }, (_, i) => i);
          return newState;
        });
      }
    } else {
      // Data cell: Toggle single channel (0-31)
      const channelIndex = col - 1;

      setTxApodization(prev => {
        const newState = [...prev];
        const rowData = [...newState[row]];

        if (rowData.includes(channelIndex)) {
          // Deselect channel
          newState[row] = rowData.filter(idx => idx !== channelIndex).sort((a, b) => a - b);
        } else {
          // Select channel
          newState[row] = [...rowData, channelIndex].sort((a, b) => a - b);
        }

        return newState;
      });
    }
  };

  // Check if a row is fully selected
  const isRowSelected = (row: number) => {
    return txApodization[row].length === 32;
  };

  // Check if a cell is selected
  const isCellSelected = (row: number, col: number) => {
    if (col === 0) {
      return isRowSelected(row);
    } else {
      const channelIndex = col - 1;
      return txApodization[row].includes(channelIndex);
    }
  };

  // Render the table
  return (
    <Box sx={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {/* Generate table rows */}
        {Array.from({ length: ROWS }, (_, row) => (
          <Box key={row} sx={{ display: 'flex' }}>
            {/* Generate table columns */}
            {Array.from({ length: COLS }, (_, col) => {
              const isSelected = isCellSelected(row, col);
              const isHeaderCell = col === 0;
              const channelIndex = col - 1;
              const isValidChannel = col === 0 || (channelIndex >= 0 && channelIndex < 32);

              // Determine cell content and styling
              const cellContent = isHeaderCell ? '●' : (isValidChannel ? channelIndex : null);
              const cellSx = {
                width: col === 0 ? '40px' : '32px',
                height: '32px',
                border: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isValidChannel ? 'pointer' : 'default',
                fontSize: '0.7rem',
                fontWeight: isHeaderCell ? 'normal' : 'normal',
              };

              // Apply different styles for header cells vs data cells
              if (isHeaderCell) {
                // Header cells (first column) use circle indicators
                Object.assign(cellSx, {
                  backgroundColor: '#f5f5f5',
                  color: isSelected ? '#007bff' : '#9e9e9e',
                  '&:hover': {
                    backgroundColor: '#e0e0e0',
                    color: isSelected ? '#0056b3' : '#757575',
                  },
                });
              } else {
                // Data cells use background color for selection
                Object.assign(cellSx, {
                  backgroundColor: isSelected ? '#007bff' : '#f5f5f5',
                  color: isSelected ? 'white' : 'inherit',
                  '&:hover': {
                    backgroundColor: isSelected ? '#0056b3' : '#e0e0e0',
                  },
                });
              }

              return (
                <Box
                  style={{ width: '100%' }}
                  key={`${row}-${col}`}
                  sx={cellSx}
                  onClick={() => isValidChannel && handleCellClick(row, col)}
                >
                  {cellContent}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default TxApodization;
