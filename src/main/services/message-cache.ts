import path from 'node:path'
import type { MessageSummary } from '../../shared/types'
import { JsonStore } from './json-store'

interface CacheData {
  version: 1
  messages: MessageSummary[]
}

export class MessageCache {
  private readonly store: JsonStore<CacheData>

  constructor(userDataPath: string) {
    this.store = new JsonStore(path.join(userDataPath, 'message-cache.json'), () => ({ version: 1, messages: [] }))
  }

  async merge(messages: MessageSummary[]): Promise<void> {
    const current = (await this.store.read()).messages
    const byKey = new Map(current.map((message) => [message.key, message]))
    for (const message of messages) byKey.set(message.key, message)
    const next = [...byKey.values()]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 3000)
    await this.store.write({ version: 1, messages: next })
  }

  async list(accountIds?: string[], mailbox = 'INBOX', query = '', limit = 80): Promise<MessageSummary[]> {
    const normalized = query.toLowerCase()
    return (await this.store.read()).messages
      .filter((message) => !accountIds?.length || accountIds.includes(message.accountId))
      .filter((message) => message.mailbox === mailbox)
      .filter((message) => {
        if (!normalized) return true
        return [message.subject, message.preview, ...message.from.map((item) => `${item.name} ${item.address}`)]
          .join(' ')
          .toLowerCase()
          .includes(normalized)
      })
      .slice(0, limit)
  }

  async removeAccount(accountId: string): Promise<void> {
    const data = await this.store.read()
    await this.store.write({ ...data, messages: data.messages.filter((item) => item.accountId !== accountId) })
  }
}
