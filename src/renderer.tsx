import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { RongbukDevice } from './types/devices';

import UltraSonicScannerApp from './UltraSonicScannerApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<UltraSonicScannerApp />);
}
