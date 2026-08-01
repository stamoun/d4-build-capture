import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }]
});

export const rendererConfig: Configuration = {
  devtool: 'source-map',
  module: { rules },
  resolve: { extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'] }
};
