import { describe, expect, it } from 'vitest'
import { detectProvider, detectProviderFromMx, getProvider, PROVIDERS } from '@shared/providers'

describe('provider catalog', () => {
  it('contains every required provider family', () => {
    expect(PROVIDERS.map((provider) => provider.id)).toEqual(
      expect.arrayContaining(['qq', '163', 'outlook', 'gmail', 'edu', 'custom'])
    )
  })

  it('uses encrypted IMAP defaults for known providers', () => {
    for (const id of ['qq', '163', 'outlook', 'gmail'] as const) {
      const provider = getProvider(id)
      expect(provider.imap).toMatchObject({ port: 993, secure: true })
      expect(provider.smtp?.host).toBeTruthy()
    }
  })

  it.each([
    ['person@qq.com', 'qq'],
    ['person@163.com', '163'],
    ['person@outlook.com', 'outlook'],
    ['person@gmail.com', 'gmail'],
    ['person@university.edu.cn', 'edu'],
    ['person@example.org', 'custom']
  ])('detects %s as %s', (email, expected) => {
    expect(detectProvider(email)).toBe(expected)
  })

  it('recognizes hosted Google and Microsoft domains from MX exchanges', () => {
    expect(detectProviderFromMx(['aspmx.l.google.com.'])).toBe('gmail')
    expect(detectProviderFromMx(['school-edu.mail.protection.outlook.com'])).toBe('outlook')
    expect(detectProviderFromMx(['mx.example.org'])).toBeUndefined()
    expect(detectProviderFromMx(['google.com.attacker.example'])).toBeUndefined()
  })
})
