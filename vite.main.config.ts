import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import path from 'path';

export default defineConfig({
  root: __dirname,
  mode: process.env.MODE,
  build: {
    sourcemap: 'inline',
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        'serialport',
        '@serialport/bindings-cpp',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
