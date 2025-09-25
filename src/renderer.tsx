import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, Container } from '@mui/material';
import RongbukApp from './RongbukApp';

import './fonts';

const theme = createTheme({
  typography: {
    fontFamily: 'Inter',
    fontWeightLight: 200,
    fontWeightRegular: 300,
    fontWeightMedium: 500,
    fontWeightBold: 700,
  },
});
const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <ThemeProvider theme={theme}>
      <Container maxWidth="lg" sx={{ p: 5 }}>
        <RongbukApp />
      </Container>
    </ThemeProvider>
  );
}
