import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/google-ads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/creative-operations': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/campaign-groups': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
