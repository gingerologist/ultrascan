import React from 'react';
import { Box } from '@mui/material';

// Props interface for the RxApodizationTable component
interface RxApodizationTableProps {
  rxApodization: number[];
  setRxApodization: React.Dispatch<React.SetStateAction<number[]>>;
  defaults: {
    rxApodization: number[];
  };
}

// Custom RxApodization Table Component (5 rows × 17 columns)
const RxApodizationTable: React.FC<RxApodizationTableProps> = ({
  rxApodization,
  setRxApodization,
  defaults,
}) => {
  // Table dimensions
  const ROWS = 5;
  const COLS = 17;

  // Handle table cell click
  const handleCellClick = (row: number, col: number) => {
    if (row === 0 && col === 0) {
      // Top-left corner: Select all
      const isAllSelected = rxApodization.length === 64;
      setRxApodization(isAllSelected ? [] : defaults.rxApodization);
    } else if (row === 0) {
      // First row: Select column
      let isColSelected = true;
      for (let r = 1; r < ROWS; r++) {
        const channelIndex = (r - 1) * 16 + (col - 1);
        if (channelIndex < 64 && !rxApodization.includes(channelIndex)) {
          isColSelected = false;
          break;
        }
      }

      const newSelected = [...rxApodization];
      for (let r = 1; r < ROWS; r++) {
        const channelIndex = (r - 1) * 16 + (col - 1);
        if (channelIndex >= 64) continue;

        if (isColSelected) {
          // Deselect column
          const index = newSelected.indexOf(channelIndex);
          if (index !== -1) {
            newSelected.splice(index, 1);
          }
        } else {
          // Select column
          if (!newSelected.includes(channelIndex)) {
            newSelected.push(channelIndex);
          }
        }
      }

      setRxApodization(newSelected.sort((a, b) => a - b));
    } else if (col === 0) {
      // First column: Select row
      let isRowSelected = true;
      for (let c = 1; c < COLS; c++) {
        const channelIndex = (row - 1) * 16 + (c - 1);
        if (channelIndex < 64 && !rxApodization.includes(channelIndex)) {
          isRowSelected = false;
          break;
        }
      }

      const newSelected = [...rxApodization];
      for (let c = 1; c < COLS; c++) {
        const channelIndex = (row - 1) * 16 + (c - 1);
        if (channelIndex >= 64) continue;

        if (isRowSelected) {
          // Deselect row
          const index = newSelected.indexOf(channelIndex);
          if (index !== -1) {
            newSelected.splice(index, 1);
          }
        } else {
          // Select row
          if (!newSelected.includes(channelIndex)) {
            newSelected.push(channelIndex);
          }
        }
      }

      setRxApodization(newSelected.sort((a, b) => a - b));
    } else {
      // Data cell: Toggle single channel
      const channelIndex = (row - 1) * 16 + (col - 1);
      if (channelIndex < 64) {
        setRxApodization(prev => {
          const newSelected = prev.includes(channelIndex)
            ? prev.filter(idx => idx !== channelIndex)
            : [...prev, channelIndex].sort((a, b) => a - b);
          return newSelected;
        });
      }
    }
  };

  // Check if a column is fully selected
  const isColumnSelected = (col: number) => {
    for (let r = 1; r < ROWS; r++) {
      const channelIndex = (r - 1) * 16 + (col - 1);
      if (channelIndex < 64 && !rxApodization.includes(channelIndex)) {
        return false;
      }
    }
    return true;
  };

  // Check if a row is fully selected
  const isRowSelected = (row: number) => {
    for (let c = 1; c < COLS; c++) {
      const channelIndex = (row - 1) * 16 + (c - 1);
      if (channelIndex < 64 && !rxApodization.includes(channelIndex)) {
        return false;
      }
    }
    return true;
  };

  // Check if a cell is selected
  const isCellSelected = (row: number, col: number) => {
    if (row === 0 && col === 0) {
      return rxApodization.length === 64;
    } else if (row === 0) {
      return isColumnSelected(col);
    } else if (col === 0) {
      return isRowSelected(row);
    } else {
      const channelIndex = (row - 1) * 16 + (col - 1);
      return rxApodization.includes(channelIndex);
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
              const isHeaderCell = row === 0 || col === 0;
              const channelIndex = (row - 1) * 16 + (col - 1);
              const isValidChannel = channelIndex < 64;

              // Determine cell content and styling
              const cellContent = isHeaderCell ? '●' : (isValidChannel ? channelIndex : null);
              const cellSx = {
                width: col === 0 ? '40px' : '32px',
                height: row === 0 ? '32px' : '32px',
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
                // Header cells (first row and first column) use circle indicators
                Object.assign(cellSx, {
                  backgroundColor: '#f5f5f5',
                  color: isSelected ? '#007bff' : '#9e9e9e',
                  '&:hover': {
                    backgroundColor: isValidChannel ? '#e0e0e0' : '#f5f5f5',
                    color: isValidChannel ? (isSelected ? '#0056b3' : '#757575') : '#9e9e9e',
                  },
                });
              } else {
                // Data cells use background color for selection
                Object.assign(cellSx, {
                  backgroundColor: isSelected ? '#007bff' : '#f5f5f5',
                  color: isSelected ? 'white' : 'inherit',
                  '&:hover': {
                    backgroundColor: isValidChannel ? (isSelected ? '#0056b3' : '#e0e0e0') : '#f5f5f5',
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

export default RxApodizationTable;
