import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node', // Use 'jsdom' if you need DOM APIs
    globals: true, // Enables global test functions (describe, it, expect)
    include: ['tests/**/*.{test,spec}.{js,ts}', 'src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'build'],
  },
  resolve: {
    alias: {
      // Match your webpack aliases if you have any
      '@': path.resolve(__dirname, './src'),
    },
  },
})
