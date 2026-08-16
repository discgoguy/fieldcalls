import { defineConfig } from 'vitest/config';
import path from 'path';

// Standalone Vitest config (kept separate from vite.config.js). Pure-logic unit
// tests run in a node environment — no DOM, no React plugin needed.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Some modules under test (e.g. crmUtils) import supabaseClient at load, which
    // needs env to construct the client. These placeholders keep the import from
    // throwing; the pure functions under test never touch the network.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
