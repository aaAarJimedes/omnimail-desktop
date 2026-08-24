import { contextBridge, ipcRenderer } from 'electron'
import type { OmniMailApi, SyncProgress } from '../shared/types'

const api: OmniMailApi = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  authorizeOAuth: (request) => ipcRenderer.invoke('oauth:authorize', request),
  addAccount: (request) => ipcRenderer.invoke('account:add', request),
  removeAccount: (accountId) => ipcRenderer.invoke('account:remove', accountId),
  testAccount: (accountId) => ipcRenderer.invoke('account:test', accountId),
  listFolders: (accountId) => ipcRenderer.invoke('mail:folders', accountId),
  listMessages: (request) => ipcRenderer.invoke('mail:list', request),
  getMessage: (ref) => ipcRenderer.invoke('mail:get', ref),
  setRead: (ref, read) => ipcRenderer.invoke('mail:set-read', ref, read),
  setFlagged: (ref, flagged) => ipcRenderer.invoke('mail:set-flagged', ref, flagged),
  moveMessage: (ref, targetMailbox) => ipcRenderer.invoke('mail:move', ref, targetMailbox),
  deleteMessage: (ref) => ipcRenderer.invoke('mail:delete', ref),
  sendMessage: (request) => ipcRenderer.invoke('mail:send', request),
  pickAttachments: () => ipcRenderer.invoke('attachment:pick'),
  saveAttachment: (ref, attachmentIndex) => ipcRenderer.invoke('attachment:save', ref, attachmentIndex),
  sync: (accountIds) => ipcRenderer.invoke('mail:sync', accountIds),
  onSyncProgress: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, progress: SyncProgress): void => listener(progress)
    ipcRenderer.on('mail:sync-progress', wrapped)
    return () => ipcRenderer.removeListener('mail:sync-progress', wrapped)
  }
}

contextBridge.exposeInMainWorld('omnimail', api)
