import { defineConfig } from 'vitest/config'

// Runs inside `firebase emulators:exec` (see npm run test:firebase).
export default defineConfig({
  test: {
    include: ['tests-firebase/**/*.test.js'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
