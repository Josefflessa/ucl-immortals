import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Lightweight, isolated test config (does NOT load the dev plugins / socket.io
// from vite.config.ts). The game engine is pure TS, so a node environment is enough.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['client/src/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts'],
    // Balance harness simulates full seasons — give it room.
    testTimeout: 90000,
  },
});
