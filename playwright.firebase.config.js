import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Same specs, Firebase mode: run inside `firebase emulators:exec` (npm run e2e:firebase).
process.env.E2E_FIREBASE = '1'
// Use a preinstalled Chromium when there is one (cloud dev boxes); otherwise Playwright's own.
const executablePath = process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)

export default defineConfig({
  testDir: 'e2e',
  grepInvert: /@demo/,
  timeout: 60_000,
  workers: 1,
  globalSetup: './e2e/firebase-setup.js',
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5175', trace: 'retain-on-failure', launchOptions: { executablePath }, ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  testIgnore: /responsive|a11y/,
  webServer: {
    command: 'npx vite --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-the-mood', VITE_FIREBASE_AUTH_DOMAIN: 'demo-the-mood.firebaseapp.com',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-the-mood.appspot.com', VITE_FIREBASE_APP_ID: '1:1:web:1', VITE_FIREBASE_EMULATORS: '1',
    },
  },
})
