import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, Container } from '@mui/material';
import RongbukApp from './RongbukApp';

const theme = createTheme({});
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
