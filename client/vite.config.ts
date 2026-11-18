import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const SERVER = process.env.VITE_DEV_SERVER ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared/src') },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': SERVER,
      '/socket.io': { target: SERVER, ws: true },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
