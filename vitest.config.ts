import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['src/**/__tests__/**/*.spec.ts'],
    environment: 'node'
  }
})
