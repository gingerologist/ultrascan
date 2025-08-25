import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// Add CSS rule
rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

export const modalConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
  target: 'electron-renderer',
  mode: 'development',
  // Completely disable dev server features
  optimization: {
    splitChunks: false,
  },
  // Remove all webpack-dev-server related plugins
  entry: {
    modal: './src/modal.tsx',
  },
};