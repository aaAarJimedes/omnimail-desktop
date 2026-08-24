export type ProviderId = 'qq' | '163' | 'outlook' | 'gmail' | 'edu' | 'custom'
export type AuthMode = 'password' | 'oauth2'

export interface MailServerConfig {
  host: string
  port: number
  secure: boolean
}

export interface ProviderDefinition {
  id: ProviderId
  name: string
  description: string
  accent: string
  imap?: MailServerConfig
  smtp?: MailServerConfig
  authModes: AuthMode[]
  help: string
}

export interface AccountRecord {
  id: string
  email: string
  displayName: string
  provider: ProviderId
  authMode: AuthMode
  username: string
  imap: MailServerConfig
  smtp: MailServerConfig
  oauthClientId?: string
  createdAt: string
  lastSyncAt?: string
  color: string
}

export interface CreateAccountRequest {
  email: string
  displayName: string
  provider: ProviderId
  authMode: AuthMode
  username?: string
  password?: string
  oauthHandle?: string
  oauthClientId?: string
  imap?: MailServerConfig
  smtp?: MailServerConfig
}

export interface OAuthRequest {
  provider: 'gmail' | 'outlook'
  email: string
  clientId: string
  clientSecret?: string
}

export interface OAuthResult {
  handle: string
  email: string
  expiresAt: number
}

export interface FolderInfo {
  accountId: string
  path: string
  name: string
  specialUse?: string
  unread?: number
  total?: number
}

export interface Address {
  name?: string
  address: string
}

export interface MessageSummary {
  key: string
  accountId: string
  mailbox: string
  uid: number
  subject: string
  from: Address[]
  to: Address[]
  date: string
  preview: string
  unread: boolean
  flagged: boolean
  hasAttachments: boolean
  size: number
}

export interface AttachmentInfo {
  index: number
  filename: string
  contentType: string
  size: number
  contentId?: string
}

export interface MessageDetail extends MessageSummary {
  cc: Address[]
  replyTo: Address[]
  text: string
  html?: string
  attachments: AttachmentInfo[]
  messageId?: string
}

export interface MessageListRequest {
  accountIds?: string[]
  mailbox?: string
  query?: string
  limit?: number
}

export interface MessageRef {
  accountId: string
  mailbox: string
  uid: number
}

export interface PickedAttachment {
  token: string
  name: string
  size: number
}

export interface SendMessageRequest {
  accountId: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  text: string
  html?: string
  attachmentTokens?: string[]
  inReplyTo?: string
}

export interface SyncProgress {
  accountId: string
  phase: 'connecting' | 'syncing' | 'done' | 'error'
  message?: string
}

export interface AppSnapshot {
  accounts: AccountRecord[]
  providers: ProviderDefinition[]
  appVersion: string
}

export interface OmniMailApi {
  bootstrap(): Promise<AppSnapshot>
  authorizeOAuth(request: OAuthRequest): Promise<OAuthResult>
  addAccount(request: CreateAccountRequest): Promise<AccountRecord>
  removeAccount(accountId: string): Promise<void>
  testAccount(accountId: string): Promise<void>
  listFolders(accountId: string): Promise<FolderInfo[]>
  listMessages(request: MessageListRequest): Promise<MessageSummary[]>
  getMessage(ref: MessageRef): Promise<MessageDetail>
  setRead(ref: MessageRef, read: boolean): Promise<void>
  setFlagged(ref: MessageRef, flagged: boolean): Promise<void>
  moveMessage(ref: MessageRef, targetMailbox: string): Promise<void>
  deleteMessage(ref: MessageRef): Promise<void>
  sendMessage(request: SendMessageRequest): Promise<{ messageId?: string }>
  pickAttachments(): Promise<PickedAttachment[]>
  saveAttachment(ref: MessageRef, attachmentIndex: number): Promise<string | null>
  sync(accountIds?: string[]): Promise<MessageSummary[]>
  onSyncProgress(listener: (progress: SyncProgress) => void): () => void
}

declare global {
  interface Window {
    omnimail: OmniMailApi
  }
}
