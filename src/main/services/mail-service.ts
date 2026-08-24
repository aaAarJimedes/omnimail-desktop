import { readFile } from 'node:fs/promises'
import { ImapFlow, type FetchMessageObject, type MessageAddressObject, type MessageStructureObject } from 'imapflow'
import { simpleParser, type AddressObject } from 'mailparser'
import nodemailer from 'nodemailer'
import type {
  AccountRecord,
  Address,
  FolderInfo,
  MessageDetail,
  MessageListRequest,
  MessageRef,
  MessageSummary,
  SendMessageRequest
} from '../../shared/types'
import { validateListRequest, validateMessageRef, validateSendRequest } from '../../shared/validation'
import { AccountStore } from './account-store'
import { MessageCache } from './message-cache'
import { OAuthService } from './oauth-service'
import { SecretVault, type StoredCredential } from './secret-vault'

export type AttachmentResolver = (tokens: string[]) => Promise<Array<{ filename: string; path: string }>>

function addresses(values?: MessageAddressObject[]): Address[] {
  return (values ?? [])
    .filter((value): value is MessageAddressObject & { address: string } => Boolean(value.address))
    .map((value) => ({ name: value.name, address: value.address }))
}

function parsedAddresses(value?: AddressObject | AddressObject[]): Address[] {
  const objects = Array.isArray(value) ? value : value ? [value] : []
  return objects.flatMap((object) =>
    object.value.map((item) => ({ name: item.name || undefined, address: item.address || '' })).filter((item) => item.address)
  )
}

function containsAttachment(node?: MessageStructureObject): boolean {
  if (!node) return false
  if (node.disposition?.toLowerCase() === 'attachment') return true
  if (node.dispositionParameters?.filename || node.parameters?.name) return true
  return node.childNodes?.some(containsAttachment) ?? false
}

function summaryFromMessage(accountId: string, mailbox: string, message: FetchMessageObject, preview: string): MessageSummary {
  const envelope = message.envelope
  const dateValue = envelope?.date || message.internalDate || new Date()
  return {
    key: `${accountId}:${encodeURIComponent(mailbox)}:${message.uid}`,
    accountId,
    mailbox,
    uid: message.uid,
    subject: envelope?.subject || '（无主题）',
    from: addresses(envelope?.from),
    to: addresses(envelope?.to),
    date: new Date(dateValue).toISOString(),
    preview: preview.replace(/\s+/g, ' ').trim().slice(0, 180),
    unread: !(message.flags?.has('\\Seen') ?? false),
    flagged: message.flags?.has('\\Flagged') ?? false,
    hasAttachments: containsAttachment(message.bodyStructure),
    size: message.size ?? 0
  }
}

async function previewFromSource(source?: Buffer): Promise<string> {
  if (!source) return ''
  try {
    const parsed = await simpleParser(source, { skipHtmlToText: true, skipTextToHtml: true })
    return parsed.text || ''
  } catch {
    return ''
  }
}

export class MailService {
  constructor(
    private readonly accounts: AccountStore,
    private readonly vault: SecretVault,
    private readonly oauth: OAuthService,
    private readonly cache: MessageCache,
    private readonly resolveAttachments: AttachmentResolver
  ) {}

  private async credentialFor(account: AccountRecord): Promise<StoredCredential> {
    return account.authMode === 'oauth2' ? this.oauth.getValidCredential(account) : this.vault.get(account.id)
  }

  private async imapClient(account: AccountRecord): Promise<ImapFlow> {
    const credential = await this.credentialFor(account)
    const auth =
      credential.kind === 'oauth2'
        ? { user: account.username, accessToken: credential.accessToken }
        : { user: account.username, pass: credential.password }
    const client = new ImapFlow({
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.secure,
      auth,
      logger: false,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: account.imap.host },
      socketTimeout: 45_000,
      greetingTimeout: 20_000,
      connectionTimeout: 20_000
    })
    client.on('error', () => undefined)
    await client.connect()
    return client
  }

  async test(accountId: string): Promise<void> {
    const account = await this.accounts.get(accountId)
    let client: ImapFlow | undefined
    try {
      client = await this.imapClient(account)
      await client.noop()
    } catch (error) {
      throw new Error(`无法连接 ${account.email}：${(error as Error).message}`)
    } finally {
      if (client?.usable) await client.logout().catch(() => undefined)
    }
  }

  async listFolders(accountId: string): Promise<FolderInfo[]> {
    const account = await this.accounts.get(accountId)
    let client: ImapFlow | undefined
    try {
      client = await this.imapClient(account)
      const folders = await client.list({ statusQuery: { messages: true, unseen: true } })
      return folders
        .filter((folder) => !folder.flags.has('\\Noselect'))
        .map((folder) => ({
          accountId,
          path: folder.path,
          name: folder.name,
          specialUse: folder.specialUse,
          unread: folder.status?.unseen,
          total: folder.status?.messages
        }))
    } finally {
      if (client?.usable) await client.logout().catch(() => undefined)
    }
  }

  async listMessages(raw: MessageListRequest): Promise<MessageSummary[]> {
    const request = validateListRequest(raw)
    const allAccounts = await this.accounts.list()
    const selected = request.accountIds?.length
      ? allAccounts.filter((account) => request.accountIds!.includes(account.id))
      : allAccounts
    if (!selected.length) return []

    const results = await Promise.allSettled(
      selected.map((account) => this.listAccountMessages(account, request.mailbox!, request.query!, request.limit!))
    )
    const messages = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    if (messages.length) await this.cache.merge(messages)
    const cached = await this.cache.list(
      selected.map((account) => account.id),
      request.mailbox,
      request.query,
      request.limit
    )
    return cached.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, request.limit)
  }

  private async listAccountMessages(
    account: AccountRecord,
    mailbox: string,
    query: string,
    limit: number
  ): Promise<MessageSummary[]> {
    let client: ImapFlow | undefined
    try {
      client = await this.imapClient(account)
      const opened = await client.mailboxOpen(mailbox, { readOnly: true })
      if (!opened.exists) return []
      let range: string | number[]
      if (query) {
        const found = await client.search(
          { or: [{ subject: query }, { from: query }, { body: query }] },
          { uid: true }
        )
        range = found ? found.slice(-limit) : []
      } else {
        range = `${Math.max(1, opened.exists - limit + 1)}:*`
      }
      if (Array.isArray(range) && !range.length) return []
      const messages: MessageSummary[] = []
      for await (const message of client.fetch(
        range,
        {
          uid: true,
          flags: true,
          envelope: true,
          internalDate: true,
          size: true,
          bodyStructure: true,
          source: { start: 0, maxLength: 16_384 }
        },
        { uid: Boolean(query) }
      )) {
        messages.push(summaryFromMessage(account.id, mailbox, message, await previewFromSource(message.source)))
      }
      await this.accounts.markSynced(account.id)
      return messages.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    } finally {
      if (client?.usable) await client.logout().catch(() => undefined)
    }
  }

  async getMessage(raw: MessageRef): Promise<MessageDetail> {
    const ref = validateMessageRef(raw)
    const account = await this.accounts.get(ref.accountId)
    let client: ImapFlow | undefined
    try {
      client = await this.imapClient(account)
      await client.mailboxOpen(ref.mailbox, { readOnly: true })
      const message = await client.fetchOne(String(ref.uid), { full: true, source: true }, { uid: true })
      if (!message || !message.source) throw new Error('邮件不存在或已被移动')
      const parsed = await simpleParser(message.source)
      const summary = summaryFromMessage(ref.accountId, ref.mailbox, message, parsed.text || '')
      return {
        ...summary,
        from: parsedAddresses(parsed.from),
        to: parsedAddresses(parsed.to),
        cc: parsedAddresses(parsed.cc),
        replyTo: parsedAddresses(parsed.replyTo),
        text: parsed.text || '',
        html: typeof parsed.html === 'string' ? parsed.html : undefined,
        attachments: parsed.attachments.map((attachment, index) => ({
          index,
          filename: attachment.filename || `附件-${index + 1}`,
          contentType: attachment.contentType,
          size: attachment.size,
          contentId: attachment.contentId || undefined
        })),
        messageId: parsed.messageId
      }
    } finally {
      if (client?.usable) await client.logout().catch(() => undefined)
    }
  }

  private async updateFlag(raw: MessageRef, flag: string, enabled: boolean): Promise<void> {
    const ref = validateMessageRef(raw)
    const account = await this.accounts.get(ref.accountId)
    let client: ImapFlow | undefined
    try {
      client = await this.imapClient(account)
      await client.mailboxOpen(ref.mailbox)
      if (enabled) await client.messageFlagsAdd([ref.uid], [flag], { uid: true })
      else await client.messageFlagsRemove([ref.uid], [flag], { uid: true })
    } finally {
      if (client?.usable) await client.logout().catch(() => undefined)
    }
  }

  setRead(ref: MessageRef, read: boolean): Promise<void> {
    return this.updateFlag(ref, '\\Seen', read)
  }

  setFlagged(ref: MessageRef, flagged: boolean): Promise<void> {
    return this.updateFlag(ref, '\\Flagged', flagged)
  }

  async moveMessage(raw: MessageRef, targetMailbox: string): Promise<void> {
    const ref = validateMessageRef(raw)
    if (!targetMailbox || targetMailbox.length > 512 || targetMailbox.includes('\0')) throw new Error('目标文件夹无效')
    const account = await this.accounts.get(ref.accountId)
    let client: ImapFlow | undefined
    try {
      client = await this.imapClient(account)
      await client.mailboxOpen(ref.mailbox)
      await client.messageMove([ref.uid], targetMailbox, { uid: true })
    } finally {
      if (client?.usable) await client.logout().catch(() => undefined)
    }
  }

  async deleteMessage(raw: MessageRef): Promise<void> {
    const ref = validateMessageRef(raw)
    const account = await this.accounts.get(ref.accountId)
    let client: ImapFlow | undefined
    try {
      client = await this.imapClient(account)
      await client.mailboxOpen(ref.mailbox)
      await client.messageDelete([ref.uid], { uid: true })
    } finally {
      if (client?.usable) await client.logout().catch(() => undefined)
    }
  }

  async sendMessage(raw: SendMessageRequest): Promise<{ messageId?: string }> {
    const request = validateSendRequest(raw)
    const account = await this.accounts.get(request.accountId)
    const credential = await this.credentialFor(account)
    const approvedAttachments = await this.resolveAttachments(request.attachmentTokens ?? [])
    const attachments = await Promise.all(
      approvedAttachments.map(async (attachment) => ({
        filename: attachment.filename,
        content: await readFile(attachment.path)
      }))
    )
    const auth =
      credential.kind === 'oauth2'
        ? { type: 'OAuth2' as const, user: account.username, accessToken: credential.accessToken }
        : { user: account.username, pass: credential.password }
    const transport = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      requireTLS: !account.smtp.secure,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: account.smtp.host },
      auth,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 45_000
    })
    try {
      const result = await transport.sendMail({
        from: { name: account.displayName, address: account.email },
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        subject: request.subject,
        text: request.text,
        html: request.html,
        inReplyTo: request.inReplyTo,
        attachments,
        disableFileAccess: true,
        disableUrlAccess: true
      })
      return { messageId: result.messageId }
    } finally {
      transport.close()
    }
  }

  async attachmentContent(raw: MessageRef, index: number): Promise<{ filename: string; content: Buffer }> {
    const ref = validateMessageRef(raw)
    if (!Number.isInteger(index) || index < 0 || index > 200) throw new Error('附件索引无效')
    const account = await this.accounts.get(ref.accountId)
    let client: ImapFlow | undefined
    try {
      client = await this.imapClient(account)
      await client.mailboxOpen(ref.mailbox, { readOnly: true })
      const message = await client.fetchOne(String(ref.uid), { source: true }, { uid: true })
      if (!message || !message.source) throw new Error('邮件不存在')
      const parsed = await simpleParser(message.source)
      const attachment = parsed.attachments[index]
      if (!attachment) throw new Error('附件不存在')
      return { filename: attachment.filename || `附件-${index + 1}`, content: attachment.content }
    } finally {
      if (client?.usable) await client.logout().catch(() => undefined)
    }
  }
}
