import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { AccountRecord, CreateAccountRequest } from '../../shared/types'
import { getProvider } from '../../shared/providers'
import { validateCreateAccount, validateServer } from '../../shared/validation'
import { JsonStore } from './json-store'

interface AccountData {
  version: 1
  accounts: AccountRecord[]
}

const COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2']

export class AccountStore {
  private readonly store: JsonStore<AccountData>

  constructor(userDataPath: string) {
    this.store = new JsonStore(path.join(userDataPath, 'accounts.json'), () => ({ version: 1, accounts: [] }))
  }

  async list(): Promise<AccountRecord[]> {
    return (await this.store.read()).accounts
  }

  async get(id: string): Promise<AccountRecord> {
    const account = (await this.list()).find((item) => item.id === id)
    if (!account) throw new Error('邮箱账户不存在或已删除')
    return account
  }

  async create(raw: CreateAccountRequest): Promise<AccountRecord> {
    const input = validateCreateAccount(raw)
    const provider = getProvider(input.provider)
    const accounts = await this.list()
    if (accounts.some((item) => item.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error('该邮箱已经添加')
    }
    const imap = provider.imap ?? validateServer(input.imap, 'IMAP')
    const smtp = provider.smtp ?? validateServer(input.smtp, 'SMTP')
    const record: AccountRecord = {
      id: randomUUID(),
      email: input.email,
      displayName: input.displayName,
      provider: input.provider,
      authMode: input.authMode,
      username: input.username || input.email,
      imap,
      smtp,
      oauthClientId: input.oauthClientId,
      createdAt: new Date().toISOString(),
      color: provider.accent || COLORS[accounts.length % COLORS.length]!
    }
    await this.store.write({ version: 1, accounts: [...accounts, record] })
    return record
  }

  async remove(id: string): Promise<void> {
    const data = await this.store.read()
    await this.store.write({ ...data, accounts: data.accounts.filter((item) => item.id !== id) })
  }

  async markSynced(id: string): Promise<void> {
    const data = await this.store.read()
    await this.store.write({
      ...data,
      accounts: data.accounts.map((item) =>
        item.id === id ? { ...item, lastSyncAt: new Date().toISOString() } : item
      )
    })
  }
}
