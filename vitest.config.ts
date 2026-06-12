import { defineConfig } from 'vitest/config'

// atlas/core is a symlink to src/core — without an explicit include, every
// suite runs twice.
export default defineConfig({
  test: { include: ['src/core/**/*.test.ts'] },
})
