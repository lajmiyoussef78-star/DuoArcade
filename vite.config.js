import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gastronomica/shared': path.resolve(__dirname, 'src/kitchen/shared.ts')
    }
  },
  optimizeDeps: {
    include: ['phaser']
  }
});
