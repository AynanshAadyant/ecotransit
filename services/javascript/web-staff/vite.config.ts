import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@ecotransit/contracts',
        replacement: path.resolve(__dirname, '../../../shared/javascript/contracts/src/index.ts'),
      },
      {
        find: '@ecotransit/ui/map',
        replacement: path.resolve(__dirname, '../../../shared/javascript/ui/src/map/index.ts'),
      },
      {
        find: '@ecotransit/ui',
        replacement: path.resolve(__dirname, '../../../shared/javascript/ui/src/index.ts'),
      },
    ],
  },
  server: {
    port: 5174,
  },
});
