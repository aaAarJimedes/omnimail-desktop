import type { MxRecord } from 'node:dns'
import { resolveMx } from 'node:dns/promises'
import { domainToASCII } from 'node:url'
import { detectProvider, detectProviderFromMx } from '../../shared/providers'
import type { AccountDiscovery } from '../../shared/types'
import { assertEmail } from '../../shared/validation'

type MxResolver = (domain: string) => Promise<MxRecord[]>

const DISCOVERY_TIMEOUT_MS = 4_000

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('MX 查询超时')), timeoutMs)
        timer.unref()
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function discoverAccount(
  rawEmail: string,
  resolver: MxResolver = resolveMx
): Promise<AccountDiscovery> {
  const email = assertEmail(rawEmail)
  const addressProvider = detectProvider(email)
  if (addressProvider !== 'edu' && addressProvider !== 'custom') {
    return { email, provider: addressProvider, source: 'address' }
  }

  const rawDomain = email.slice(email.lastIndexOf('@') + 1)
  const domain = domainToASCII(rawDomain.toLowerCase())
  if (!domain) return { email, provider: addressProvider, source: 'fallback' }

  try {
    const records = await withTimeout(resolver(domain), DISCOVERY_TIMEOUT_MS)
    const hostedProvider = detectProviderFromMx(records.map((record) => record.exchange))
    if (hostedProvider) return { email, provider: hostedProvider, source: 'mx' }
  } catch {
    // DNS failures should never block manual setup.
  }
  return { email, provider: addressProvider, source: addressProvider === 'edu' ? 'address' : 'fallback' }
}
