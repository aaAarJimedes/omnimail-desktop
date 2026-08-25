import { describe, expect, it } from 'vitest'
import { oauthAvailability, resolveOAuthClientIds } from '../src/main/oauth-config'

describe('OAuth build configuration', () => {
  it('normalizes configured public client IDs', () => {
    const clients = resolveOAuthClientIds({
      OMNIMAIL_GOOGLE_CLIENT_ID: '  google-client  ',
      OMNIMAIL_MICROSOFT_CLIENT_ID: 'microsoft-client'
    })
    expect(clients).toEqual({ gmail: 'google-client', outlook: 'microsoft-client' })
    expect(oauthAvailability(clients)).toEqual({ gmail: true, outlook: true })
  })

  it('treats blank or implausibly long values as unconfigured', () => {
    const clients = resolveOAuthClientIds({
      OMNIMAIL_GOOGLE_CLIENT_ID: ' ',
      OMNIMAIL_MICROSOFT_CLIENT_ID: 'x'.repeat(513)
    })
    expect(oauthAvailability(clients)).toEqual({ gmail: false, outlook: false })
  })
})
