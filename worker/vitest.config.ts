import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // `cloudflare:email` only exists in the Workers runtime; stub it for Node/Vitest.
      'cloudflare:email': fileURLToPath(new URL('./test/stubs/cloudflare-email.ts', import.meta.url)),
    },
  },
});
