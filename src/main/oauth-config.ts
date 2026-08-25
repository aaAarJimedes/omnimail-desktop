import type { OAuthProviderId } from '../shared/types'

export type OAuthClientIds = Record<OAuthProviderId, string | undefined>

const BUILD_ENVIRONMENT: Record<string, string | undefined> = {
  OMNIMAIL_GOOGLE_CLIENT_ID: process.env.OMNIMAIL_GOOGLE_CLIENT_ID,
  OMNIMAIL_MICROSOFT_CLIENT_ID: process.env.OMNIMAIL_MICROSOFT_CLIENT_ID
}

function normalizeClientId(value: string | undefined): string | undefined {
  const clientId = value?.trim()
  if (!clientId || clientId.length > 512) return undefined
  return clientId
}

export function resolveOAuthClientIds(
  environment: Record<string, string | undefined> = BUILD_ENVIRONMENT
): OAuthClientIds {
  return {
    gmail: normalizeClientId(environment.OMNIMAIL_GOOGLE_CLIENT_ID),
    outlook: normalizeClientId(environment.OMNIMAIL_MICROSOFT_CLIENT_ID)
  }
}

export function oauthAvailability(clientIds: OAuthClientIds): Record<OAuthProviderId, boolean> {
  return {
    gmail: Boolean(clientIds.gmail),
    outlook: Boolean(clientIds.outlook)
  }
}
