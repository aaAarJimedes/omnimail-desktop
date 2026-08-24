import { mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { MessageCache } from '../src/main/services/message-cache'
import type { MessageSummary } from '@shared/types'

function message(overrides: Partial<MessageSummary> = {}): MessageSummary {
  return {
    key: 'account:INBOX:1',
    accountId: 'account',
    mailbox: 'INBOX',
    uid: 1,
    subject: 'Project update',
    from: [{ name: 'Alice', address: 'alice@example.com' }],
    to: [{ address: 'me@example.com' }],
    date: '2026-08-24T00:00:00.000Z',
    preview: 'The latest report is attached.',
    unread: true,
    flagged: false,
    hasAttachments: true,
    size: 1024,
    ...overrides
  }
}

describe('message cache', () => {
  let cache: MessageCache

  beforeEach(async () => {
    const root = process.env['OMNIMAIL_TEST_TMP'] || path.join(os.tmpdir(), 'omnimail-tests')
    const directory = path.join(root, randomUUID())
    await mkdir(directory, { recursive: true })
    cache = new MessageCache(directory)
  })

  it('merges by stable key and keeps the newest value', async () => {
    await cache.merge([message()])
    await cache.merge([message({ unread: false, preview: 'Updated' })])
    const result = await cache.list(['account'])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ unread: false, preview: 'Updated' })
  })

  it('supports local sender, subject, and preview search', async () => {
    await cache.merge([message(), message({ key: 'account:INBOX:2', uid: 2, subject: 'Dinner', preview: 'At seven' })])
    expect(await cache.list(['account'], 'INBOX', 'Alice')).toHaveLength(2)
    expect(await cache.list(['account'], 'INBOX', 'report')).toHaveLength(1)
    expect(await cache.list(['account'], 'INBOX', 'Dinner')).toHaveLength(1)
  })

  it('removes only messages owned by the deleted account', async () => {
    await cache.merge([message(), message({ key: 'other:INBOX:1', accountId: 'other' })])
    await cache.removeAccount('account')
    expect(await cache.list()).toEqual([expect.objectContaining({ accountId: 'other' })])
  })
})
