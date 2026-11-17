import { defineConfig } from 'vitest/config'

// One file configures both Vite and Vitest.
// https://vite.dev/config/ and https://vitest.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /<repository>/.
  base: '/sysvinit-service-generator/',
  test: {
    coverage: {
      // Listing the sources reports a file no test imports as 0%, instead of
      // leaving it out of the total.
      include: ['src/**/*.ts'],
      thresholds: { 100: true }
    }
  }
})
