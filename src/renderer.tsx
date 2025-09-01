import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
} from '@mui/material';
import UltraSonicScannerApp from './UltraSonicScannerApp';

// Create a custom MUI theme that matches your previous color scheme
// const theme = createTheme({
//   palette: {
//     primary: {
//       main: '#3b82f6', // blue.500
//       dark: '#2563eb', // blue.600
//     },
//     secondary: {
//       main: '#4b5563', // gray.600
//     },
//     error: {
//       main: '#ef4444', // red.500
//     },
//     success: {
//       main: '#10b981', // green.500
//     },
//     grey: {
//       50: '#f9fafb',
//       100: '#f3f4f6',
//       200: '#e5e7eb',
//       600: '#4b5563',
//       700: '#374151',
//     },
//     background: {
//       default: '#ffffff',
//       paper: '#ffffff',
//     },
//   },
//   components: {
//     // Customize button component to match your previous styling
//     MuiButton: {
//       styleOverrides: {
//         root: {
//           textTransform: 'none', // Prevent uppercase transformation
//           fontWeight: 500, // medium weight
//           borderRadius: '6px', // md border radius
//         },
//       },
//       variants: [
//         {
//           props: { variant: 'contained' },
//           style: {
//             backgroundColor: '#3b82f6',
//             '&:hover': {
//               backgroundColor: '#2563eb',
//             },
//           },
//         },
//         {
//           props: { variant: 'outlined' },
//           style: {
//             borderColor: '#e5e7eb',
//             backgroundColor: '#ffffff',
//             '&:hover': {
//               backgroundColor: '#f9fafb',
//             },
//           },
//         },
//       ],
//     },
//   },
//   typography: {
//     fontFamily: [
//       '-apple-system',
//       'BlinkMacSystemFont',
//       '"Segoe UI"',
//       'Roboto',
//       '"Helvetica Neue"',
//       'Arial',
//       'sans-serif',
//     ].join(','),
//   },
// });

const theme = createTheme({});
const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <ThemeProvider theme={theme}>
      {/* CssBaseline provides consistent CSS baseline across browsers */}
      <CssBaseline />
      <Container maxWidth="lg" sx={{ p: 5 }}>
        <UltraSonicScannerApp />
      </Container>
    </ThemeProvider>
  );
}
