import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const oauthDefines = {
  'process.env.OMNIMAIL_GOOGLE_CLIENT_ID': JSON.stringify(process.env.OMNIMAIL_GOOGLE_CLIENT_ID ?? ''),
  'process.env.OMNIMAIL_MICROSOFT_CLIENT_ID': JSON.stringify(process.env.OMNIMAIL_MICROSOFT_CLIENT_ID ?? '')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: oauthDefines,
    resolve: {
      alias: {
        '@shared': path.resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': path.resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': path.resolve('src/renderer/src'),
        '@shared': path.resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
