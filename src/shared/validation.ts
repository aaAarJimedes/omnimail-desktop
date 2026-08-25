import type {
  CreateAccountRequest,
  MailServerConfig,
  MessageListRequest,
  MessageRef,
  OAuthRequest,
  SendMessageRequest
} from './types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function assertEmail(value: string, field = '邮箱地址'): string {
  const email = value.trim()
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new Error(`${field}格式不正确`)
  return email
}

export function assertId(value: unknown, field = 'ID'): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new Error(`${field}无效`)
  }
  return value
}

export function validateServer(value: MailServerConfig | undefined, name: string): MailServerConfig {
  if (!value || typeof value.host !== 'string' || !/^[a-zA-Z0-9.-]+$/.test(value.host)) {
    throw new Error(`${name}服务器地址无效`)
  }
  if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535) {
    throw new Error(`${name}端口无效`)
  }
  return { host: value.host.toLowerCase(), port: value.port, secure: Boolean(value.secure) }
}

export function validateCreateAccount(value: CreateAccountRequest): CreateAccountRequest {
  if (!value || typeof value !== 'object') throw new Error('账户参数无效')
  const email = assertEmail(value.email)
  const displayName = String(value.displayName ?? '').trim().slice(0, 80) || email.split('@')[0]!
  if (value.authMode === 'password' && (!value.password || value.password.length > 1024)) {
    throw new Error('请输入授权码或应用专用密码')
  }
  if (value.authMode === 'oauth2' && !value.oauthHandle) throw new Error('请先完成 OAuth 授权')
  return { ...value, email, displayName, username: value.username?.trim() || email }
}

export function validateOAuth(value: OAuthRequest): OAuthRequest {
  if (!value || !['gmail', 'outlook'].includes(value.provider)) throw new Error('OAuth 提供商无效')
  const clientId = String(value.clientId ?? '').trim()
  if (clientId.length > 512) throw new Error('OAuth 客户端 ID 无效')
  const clientSecret = value.clientSecret?.trim()
  if (clientSecret && clientSecret.length > 1024) throw new Error('OAuth 客户端密钥无效')
  return {
    provider: value.provider,
    email: assertEmail(value.email),
    clientId: clientId || undefined,
    clientSecret: clientSecret || undefined
  }
}

export function validateMessageRef(value: MessageRef): MessageRef {
  if (!value || typeof value !== 'object') throw new Error('邮件引用无效')
  const mailbox = String(value.mailbox ?? '')
  if (!mailbox || mailbox.length > 512 || mailbox.includes('\0')) throw new Error('邮件文件夹无效')
  if (!Number.isSafeInteger(value.uid) || value.uid < 1) throw new Error('邮件 UID 无效')
  return { accountId: assertId(value.accountId, '账户 ID'), mailbox, uid: value.uid }
}

export function validateListRequest(value: MessageListRequest): MessageListRequest {
  const limit = Math.min(Math.max(Number(value?.limit) || 80, 1), 300)
  const query = String(value?.query ?? '').trim().slice(0, 200)
  const mailbox = String(value?.mailbox ?? 'INBOX').slice(0, 512)
  return {
    accountIds: value?.accountIds?.map((id) => assertId(id, '账户 ID')).slice(0, 50),
    mailbox,
    query,
    limit
  }
}

export function validateSendRequest(value: SendMessageRequest): SendMessageRequest {
  if (!value || typeof value !== 'object') throw new Error('发信参数无效')
  const to = value.to.map((email) => assertEmail(email, '收件人')).slice(0, 100)
  if (to.length === 0) throw new Error('请至少填写一位收件人')
  return {
    ...value,
    accountId: assertId(value.accountId, '账户 ID'),
    to,
    cc: value.cc?.map((email) => assertEmail(email, '抄送人')).slice(0, 100),
    bcc: value.bcc?.map((email) => assertEmail(email, '密送人')).slice(0, 100),
    subject: String(value.subject ?? '').slice(0, 998),
    text: String(value.text ?? '').slice(0, 5_000_000),
    html: value.html ? String(value.html).slice(0, 5_000_000) : undefined,
    attachmentTokens: value.attachmentTokens?.map((token) => assertId(token, '附件令牌')).slice(0, 20)
  }
}
