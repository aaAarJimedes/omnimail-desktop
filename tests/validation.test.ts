import { describe, expect, it } from 'vitest'
import {
  assertEmail,
  validateCreateAccount,
  validateListRequest,
  validateMessageRef,
  validateOAuth,
  validateSendRequest
} from '@shared/validation'

describe('IPC input validation', () => {
  it('normalizes valid email addresses', () => {
    expect(assertEmail('  USER@example.com ')).toBe('USER@example.com')
  })

  it.each(['missing-at.example.com', 'a@b', 'a b@example.com', '@example.com'])(
    'rejects invalid email %s',
    (email) => expect(() => assertEmail(email)).toThrow()
  )

  it('requires a password credential for password accounts', () => {
    expect(() =>
      validateCreateAccount({
        email: 'test@example.com',
        displayName: 'Test',
        provider: 'custom',
        authMode: 'password'
      })
    ).toThrow(/授权码/)
  })

  it('allows a build-configured OAuth client without a renderer client ID', () => {
    expect(validateOAuth({ provider: 'gmail', email: 'person@gmail.com' })).toEqual({
      provider: 'gmail',
      email: 'person@gmail.com',
      clientId: undefined,
      clientSecret: undefined
    })
  })

  it('caps list limits and query length', () => {
    const result = validateListRequest({ limit: 50_000, query: 'x'.repeat(500) })
    expect(result.limit).toBe(300)
    expect(result.query).toHaveLength(200)
  })

  it('rejects malformed message references', () => {
    expect(() => validateMessageRef({ accountId: '../secret', mailbox: 'INBOX', uid: 1 })).toThrow()
    expect(() => validateMessageRef({ accountId: 'safe_id', mailbox: 'INBOX\0bad', uid: 1 })).toThrow()
    expect(() => validateMessageRef({ accountId: 'safe_id', mailbox: 'INBOX', uid: 0 })).toThrow()
  })

  it('normalizes and validates recipients', () => {
    const result = validateSendRequest({
      accountId: 'account_1',
      to: [' first@example.com ', 'second@example.com'],
      subject: 'Hello',
      text: 'Body'
    })
    expect(result.to).toEqual(['first@example.com', 'second@example.com'])
  })
})
