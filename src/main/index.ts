import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, BrowserWindow, net, protocol, session } from 'electron'
import { registerIpc } from './ipc'
import { isTrustedRendererUrl } from './security'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'omnimail',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false }
  }
])

function createWindow(): void {
  const smokeTest = process.env['OMNIMAIL_SMOKE_TEST'] === '1'
  const window = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1050,
    minHeight: 680,
    show: false,
    backgroundColor: '#eef2f6',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#eef2f6', symbolColor: '#334155', height: 42 },
    webPreferences: {
      preload: path.join(currentDir, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    }
  })

  window.once('ready-to-show', () => {
    if (!smokeTest) window.show()
  })
  if (smokeTest) {
    const timeout = setTimeout(() => {
      console.error('OMNIMAIL_SMOKE_FAILED: renderer timeout')
      app.exit(2)
    }, 15_000)
    window.webContents.once('did-finish-load', async () => {
      clearTimeout(timeout)
      try {
        const result = (await window.webContents.executeJavaScript(
          '({ title: document.title, bridge: typeof window.omnimail, root: Boolean(document.querySelector("#root")) })'
        )) as { title: string; bridge: string; root: boolean }
        if (result.title !== 'OmniMail' || result.bridge !== 'object' || !result.root) throw new Error(JSON.stringify(result))
        console.log(`OMNIMAIL_SMOKE_OK: ${JSON.stringify(result)}`)
        app.exit(0)
      } catch (error) {
        console.error(`OMNIMAIL_SMOKE_FAILED: ${(error as Error).message}`)
        app.exit(2)
      }
    })
  }
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault()
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (!app.isPackaged && process.env['VITE_DEV_SERVER_URL']) {
    void window.loadURL(process.env['VITE_DEV_SERVER_URL'])
  } else {
    void window.loadURL('omnimail://app/index.html')
  }
}

app.setAppUserModelId('dev.omnimail.desktop')

app.whenReady().then(async () => {
  const rendererRoot = path.resolve(currentDir, '../renderer')
  protocol.handle('omnimail', (request) => {
    const url = new URL(request.url)
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
    const target = path.resolve(rendererRoot, relative)
    if (target !== rendererRoot && !target.startsWith(`${rendererRoot}${path.sep}`)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(target).toString())
  })

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
