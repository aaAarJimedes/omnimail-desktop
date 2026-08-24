import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve('src/shared')
    }
  },
  test: {
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage'
    }
  }
})
