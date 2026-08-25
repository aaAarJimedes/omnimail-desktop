import { randomUUID } from 'node:crypto'
import { stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { PROVIDERS } from '../shared/providers'
import type { CreateAccountRequest, OAuthRequest, PickedAttachment, SendMessageRequest } from '../shared/types'
import { assertId, validateMessageRef } from '../shared/validation'
import { AccountStore } from './services/account-store'
import { MailService } from './services/mail-service'
import { MessageCache } from './services/message-cache'
import { OAuthService } from './services/oauth-service'
import { SecretVault, type StoredCredential } from './services/secret-vault'
import { isTrustedRendererUrl } from './security'
import { oauthAvailability, resolveOAuthClientIds } from './oauth-config'
import { discoverAccount } from './services/account-discovery'

interface ApprovedAttachment {
  path: string
  name: string
  size: number
  expiresAt: number
}

const approvedAttachments = new Map<string, ApprovedAttachment>()

const PROVIDER_HELP_URLS = {
  qq: 'https://mail.qq.com/',
  '163': 'https://email.163.com/'
} as const

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url || ''
  if (!isTrustedRendererUrl(url)) throw new Error('已阻止来自非受信任页面的请求')
}

async function resolveAttachments(tokens: string[]): Promise<Array<{ filename: string; path: string }>> {
  const now = Date.now()
  return tokens.map((raw) => {
    const token = assertId(raw, '附件令牌')
    const approved = approvedAttachments.get(token)
    approvedAttachments.delete(token)
    if (!approved || approved.expiresAt < now) throw new Error('附件授权已失效，请重新选择')
    return { filename: approved.name, path: approved.path }
  })
}

export function registerIpc(): void {
  const userData = app.getPath('userData')
  const accounts = new AccountStore(userData)
  const vault = new SecretVault(userData)
  const cache = new MessageCache(userData)
  const oauthClientIds = resolveOAuthClientIds()
  const oauth = new OAuthService(vault, oauthClientIds)
  const mail = new MailService(accounts, vault, oauth, cache, resolveAttachments)

  const handle = <T extends unknown[], R>(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: T) => Promise<R> | R
  ): void => {
    ipcMain.handle(channel, async (event, ...args: T) => {
      assertTrustedSender(event)
      return listener(event, ...args)
    })
  }

  handle('app:bootstrap', async () => ({
    accounts: await accounts.list(),
    providers: PROVIDERS,
    oauthConfigured: oauthAvailability(oauthClientIds),
    appVersion: app.getVersion()
  }))

  handle<[string], Awaited<ReturnType<typeof discoverAccount>>>('account:discover', (_event, email) =>
    discoverAccount(email)
  )

  handle<['qq' | '163'], void>('provider:open-help', async (_event, provider) => {
    if (provider !== 'qq' && provider !== '163') throw new Error('不支持的服务商帮助入口')
    await shell.openExternal(PROVIDER_HELP_URLS[provider], { activate: true })
  })

  handle<[OAuthRequest], Awaited<ReturnType<OAuthService['authorize']>>>('oauth:authorize', (_event, request) =>
    oauth.authorize(request)
  )

  handle<[CreateAccountRequest], Awaited<ReturnType<AccountStore['create']>>>('account:add', async (_event, request) => {
    let credential: StoredCredential
    if (request.authMode === 'oauth2') {
      const pending = oauth.consume(assertId(request.oauthHandle, 'OAuth 授权句柄'))
      credential = pending.credential
      request = { ...request, email: pending.email, oauthClientId: pending.credential.clientId }
    } else {
      credential = { kind: 'password', password: request.password || '' }
    }

    const account = await accounts.create(request)
    try {
      await vault.set(account.id, credential)
      await mail.test(account.id)
      return account
    } catch (error) {
      await Promise.allSettled([accounts.remove(account.id), vault.remove(account.id)])
      throw error
    }
  })

  handle<[string], void>('account:remove', async (_event, rawId) => {
    const id = assertId(rawId, '账户 ID')
    await Promise.all([accounts.remove(id), vault.remove(id), cache.removeAccount(id)])
  })

  handle<[string], void>('account:test', (_event, id) => mail.test(assertId(id, '账户 ID')))
  handle<[string], Awaited<ReturnType<MailService['listFolders']>>>('mail:folders', (_event, id) =>
    mail.listFolders(assertId(id, '账户 ID'))
  )
  handle<Parameters<MailService['listMessages']>, Awaited<ReturnType<MailService['listMessages']>>>(
    'mail:list',
    (_event, request) => mail.listMessages(request)
  )
  handle<Parameters<MailService['getMessage']>, Awaited<ReturnType<MailService['getMessage']>>>(
    'mail:get',
    (_event, ref) => mail.getMessage(ref)
  )
  handle<[Parameters<MailService['setRead']>[0], boolean], void>('mail:set-read', (_event, ref, read) =>
    mail.setRead(ref, Boolean(read))
  )
  handle<[Parameters<MailService['setFlagged']>[0], boolean], void>('mail:set-flagged', (_event, ref, flagged) =>
    mail.setFlagged(ref, Boolean(flagged))
  )
  handle<[Parameters<MailService['moveMessage']>[0], string], void>('mail:move', (_event, ref, target) =>
    mail.moveMessage(ref, target)
  )
  handle<Parameters<MailService['deleteMessage']>, void>('mail:delete', (_event, ref) => mail.deleteMessage(ref))
  handle<[SendMessageRequest], Awaited<ReturnType<MailService['sendMessage']>>>('mail:send', (_event, request) =>
    mail.sendMessage(request)
  )

  handle<[], PickedAttachment[]>('attachment:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择邮件附件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '所有文件', extensions: ['*'] }]
    })
    if (result.canceled) return []
    const picked: PickedAttachment[] = []
    let totalSize = 0
    for (const filename of result.filePaths.slice(0, 20)) {
      const fileStat = await stat(filename)
      if (!fileStat.isFile()) continue
      totalSize += fileStat.size
      if (fileStat.size > 25 * 1024 * 1024 || totalSize > 100 * 1024 * 1024) {
        throw new Error('单个附件不得超过 25 MB，总附件不得超过 100 MB')
      }
      const token = randomUUID()
      const name = path.basename(filename)
      approvedAttachments.set(token, { path: filename, name, size: fileStat.size, expiresAt: Date.now() + 60 * 60_000 })
      picked.push({ token, name, size: fileStat.size })
    }
    return picked
  })

  handle<[Parameters<MailService['attachmentContent']>[0], number], string | null>(
    'attachment:save',
    async (_event, rawRef, index) => {
      const ref = validateMessageRef(rawRef)
      const attachment = await mail.attachmentContent(ref, index)
      const result = await dialog.showSaveDialog({
        title: '保存附件',
        defaultPath: path.basename(attachment.filename)
      })
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, attachment.content, { flag: 'w' })
      return result.filePath
    }
  )

  handle<[string[] | undefined], Awaited<ReturnType<MailService['listMessages']>>>('mail:sync', async (event, rawIds) => {
    const ids = rawIds?.map((id) => assertId(id, '账户 ID'))
    const selected = ids?.length ? ids : (await accounts.list()).map((account) => account.id)
    const messages = []
    for (const accountId of selected) {
      event.sender.send('mail:sync-progress', { accountId, phase: 'connecting' })
      try {
        const result = await mail.listMessages({ accountIds: [accountId], mailbox: 'INBOX', limit: 80 })
        messages.push(...result)
        event.sender.send('mail:sync-progress', { accountId, phase: 'done' })
      } catch (error) {
        event.sender.send('mail:sync-progress', {
          accountId,
          phase: 'error',
          message: (error as Error).message
        })
      }
    }
    return messages.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  })
}
