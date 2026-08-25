import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'))
const runtimeDependencies = Object.keys(packageJson.dependencies ?? {})
const sharedAlias = path.join(projectRoot, 'src/shared')
const oauthDefines = {
  'process.env.OMNIMAIL_GOOGLE_CLIENT_ID': JSON.stringify(process.env.OMNIMAIL_GOOGLE_CLIENT_ID ?? ''),
  'process.env.OMNIMAIL_MICROSOFT_CLIENT_ID': JSON.stringify(process.env.OMNIMAIL_MICROSOFT_CLIENT_ID ?? '')
}

await build({
  configFile: false,
  root: projectRoot,
  define: oauthDefines,
  resolve: { alias: { '@shared': sharedAlias } },
  build: {
    ssr: path.join(projectRoot, 'src/main/index.ts'),
    outDir: path.join(projectRoot, 'out/main'),
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: {
      external: ['electron', ...runtimeDependencies],
      output: { format: 'es', entryFileNames: 'index.js' }
    }
  }
})

await build({
  configFile: false,
  root: projectRoot,
  resolve: { alias: { '@shared': sharedAlias } },
  build: {
    ssr: path.join(projectRoot, 'src/preload/index.ts'),
    outDir: path.join(projectRoot, 'out/preload'),
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: {
      external: ['electron'],
      output: { format: 'cjs', entryFileNames: 'index.cjs' }
    }
  }
})

await build({
  configFile: false,
  root: path.join(projectRoot, 'src/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': path.join(projectRoot, 'src/renderer/src'),
      '@shared': sharedAlias
    }
  },
  build: {
    outDir: path.join(projectRoot, 'out/renderer'),
    emptyOutDir: true
  }
})
