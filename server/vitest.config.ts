import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-unit-testing-2024';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
  },
});
