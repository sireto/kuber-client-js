import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: [], // Add any setup files if needed
    alias: {
      'src/': new URL('./src/', import.meta.url).pathname,
    },
    reporters: ['default', 'html'],
    outputFile: 'test-report.html'
  },
});
