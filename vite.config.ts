import { defineConfig } from 'vitest/config'

// One file configures both Vite and Vitest.
// https://vite.dev/config/ and https://vitest.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /<repository>/.
  base: '/sysvinit-service-generator/'
})
