import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Typography,
  Paper,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import JSONEditor from './JSONEditor';

// Test configurations mapping
const TEST_CONFIGS = {
  'Basic Scan Configuration': {
    version: '1.0',
    name: 'Basic Test',
    angles: [
      { degree: -10, masks: new Array(32).fill(0) },
      { degree: 0, masks: new Array(32).fill(0) },
      { degree: 10, masks: new Array(32).fill(0) },
    ],
    patterns: [
      [5, 0], // 5 clocks, Float
      [3, 2], // 3 clocks, Positive
      [2, 1], // 2 clocks, Minus
    ],
    repeat: 3,
    tail: 1,
    txStartDel: -1,
    startUs: 20,
    endUs: 50,
  },
  'High Resolution Scan': {
    version: '1.0',
    name: 'High Resolution',
    angles: [
      { degree: -45, masks: new Array(32).fill(1) },
      { degree: -30, masks: new Array(32).fill(0) },
      { degree: -15, masks: new Array(32).fill(0) },
      { degree: 0, masks: new Array(32).fill(0) },
      { degree: 15, masks: new Array(32).fill(0) },
      { degree: 30, masks: new Array(32).fill(0) },
      { degree: 45, masks: new Array(32).fill(1) },
    ],
    patterns: [
      [8, 0], // Float
      [4, 2], // Positive
      [6, 1], // Minus
      [2, 3], // Ground
    ],
    repeat: 5,
    tail: 2,
    txStartDel: 0,
    startUs: 22,
    endUs: 100,
  },
  'Wide Range Scan': {
    version: '1.0',
    name: 'Wide Range',
    angles: Array.from({ length: 19 }, (_, i) => ({
      degree: -45 + i * 5, // -45 to 45 in 5-degree steps
      masks: new Array(32).fill(0),
    })),
    patterns: [
      [10, 0], // Long float
      [1, 2], // Short positive
      [15, 1], // Long minus
      [3, 3], // Short ground
    ],
    repeat: 2,
    tail: 0,
    txStartDel: 1,
    startUs: 30,
    endUs: 150,
  },
  'Precision Test': {
    version: '1.0',
    name: 'Precision Test',
    angles: [
      { degree: -2, masks: new Array(32).fill(0) },
      { degree: -1, masks: new Array(32).fill(0) },
      { degree: 0, masks: new Array(32).fill(0) },
      { degree: 1, masks: new Array(32).fill(0) },
      { degree: 2, masks: new Array(32).fill(0) },
    ],
    patterns: [
      [1, 0], // Minimal float
      [1, 2], // Minimal positive
      [1, 1], // Minimal minus
      [31, 3], // Maximum ground
    ],
    repeat: 10,
    tail: 5,
    txStartDel: -1,
    startUs: 20,
    endUs: 22,
  },
  'Empty Configuration': {
    version: '1.0',
    name: 'Empty Test',
    angles: [],
    patterns: [],
    repeat: 1,
    tail: 0,
    txStartDel: -1,
    startUs: 20,
    endUs: 22,
  },
} as const;

// Create MUI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#3b82f6',
      dark: '#2563eb',
    },
    secondary: {
      main: '#4b5563',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
});

const TestingInterface: React.FC = () => {
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [jsonOutput, setJsonOutput] = useState<string>('');

  const handleConfigChange = useCallback((configName: string) => {
    setSelectedConfig(configName);

    if (configName && TEST_CONFIGS[configName as keyof typeof TEST_CONFIGS]) {
      const config = TEST_CONFIGS[configName as keyof typeof TEST_CONFIGS];
      const jsonString = JSON.stringify(config, null, 2);
      setJsonOutput(jsonString);
    } else {
      setJsonOutput('');
    }
  }, []);

  const handleSend = useCallback(() => {
    if (jsonOutput.trim()) {
      // Here you would typically send the JSON to your backend or main process
      console.log('Sending configuration:', jsonOutput);

      // For Electron, you might do something like:
      // window.electronAPI?.sendTestConfig(jsonOutput);

      // Or make an HTTP request:
      // fetch('/api/test-config', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: jsonOutput
      // });

      alert('Configuration sent! (Check console for details)');
    } else {
      alert('Please select a configuration first.');
    }
  }, [jsonOutput]);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom color="primary" fontWeight="bold">
        Testing Interface
      </Typography>

      <Paper elevation={3} sx={{ p: 3 }}>
        {/* Configuration Dropdown */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="config-select-label">
            Select Test Configuration
          </InputLabel>
          <Select
            labelId="config-select-label"
            value={selectedConfig}
            label="Select Test Configuration"
            onChange={e => handleConfigChange(e.target.value)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {Object.keys(TEST_CONFIGS).map(configName => (
              <MenuItem key={configName} value={configName}>
                {configName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* JSON Display Textarea */}
        <TextField
          fullWidth
          multiline
          rows={20}
          value={jsonOutput}
          placeholder="Select a configuration to see the JSON output here..."
          InputProps={{
            readOnly: true,
            sx: {
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              backgroundColor: '#f8f9fa',
            },
          }}
          sx={{
            mb: 3,
            '& .MuiInputBase-root': {
              maxHeight: '400px',
            },
          }}
        />

        {/* Send Button */}
        <Box display="flex" justifyContent="center">
          <Button
            variant="contained"
            size="large"
            endIcon={<SendIcon />}
            onClick={handleSend}
            disabled={!jsonOutput.trim()}
            sx={{ minWidth: 120 }}
          >
            Send
          </Button>
        </Box>

        {/* <JSONEditor content={{ text: '{}' }} readOnly={true} /> */}
      </Paper>
    </Container>
  );
};

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TestingInterface />
    </ThemeProvider>
  );
}
