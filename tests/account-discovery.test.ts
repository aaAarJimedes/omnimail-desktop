import { describe, expect, it, vi } from 'vitest'
import { discoverAccount } from '../src/main/services/account-discovery'

describe('account discovery', () => {
  it('uses a known address provider without a DNS lookup', async () => {
    const resolver = vi.fn()
    await expect(discoverAccount('person@qq.com', resolver)).resolves.toEqual({
      email: 'person@qq.com',
      provider: 'qq',
      source: 'address'
    })
    expect(resolver).not.toHaveBeenCalled()
  })

  it('routes an EDU domain hosted by Google to Gmail OAuth', async () => {
    const resolver = vi.fn(async () => [{ exchange: 'aspmx.l.google.com', priority: 1 }])
    await expect(discoverAccount('student@university.edu', resolver)).resolves.toMatchObject({
      provider: 'gmail',
      source: 'mx'
    })
    expect(resolver).toHaveBeenCalledWith('university.edu')
  })

  it('routes a custom Microsoft 365 domain to Outlook OAuth', async () => {
    const resolver = vi.fn(async () => [{ exchange: 'example-org.mail.protection.outlook.com', priority: 0 }])
    await expect(discoverAccount('person@example.org', resolver)).resolves.toMatchObject({
      provider: 'outlook',
      source: 'mx'
    })
  })

  it('falls back to manual setup when DNS fails', async () => {
    const resolver = vi.fn(async () => { throw new Error('offline') })
    await expect(discoverAccount('person@example.org', resolver)).resolves.toMatchObject({
      provider: 'custom',
      source: 'fallback'
    })
  })
})
