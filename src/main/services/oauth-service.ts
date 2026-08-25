import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { shell } from 'electron'
import type { AccountRecord, OAuthRequest, OAuthResult } from '../../shared/types'
import { validateOAuth } from '../../shared/validation'
import type { OAuthClientIds } from '../oauth-config'
import type { OAuthCredential } from './secret-vault'
import { SecretVault } from './secret-vault'

interface OAuthProviderConfig {
  authorizationEndpoint: string
  tokenEndpoint: string
  scope: string
  loopbackHost: '127.0.0.1' | 'localhost'
  callbackPath: string
}

interface PendingAuthorization {
  credential: OAuthCredential
  email: string
  expiresAt: number
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  id_token?: string
  error?: string
  error_description?: string
}

const CONFIG: Record<OAuthRequest['provider'], OAuthProviderConfig> = {
  gmail: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scope: 'openid email https://mail.google.com/',
    loopbackHost: '127.0.0.1',
    callbackPath: '/oauth/callback'
  },
  outlook: {
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope:
      'openid email offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
    loopbackHost: 'localhost',
    callbackPath: '/'
  }
}

function base64Url(value: Buffer): string {
  return value.toString('base64url')
}

function emailFromIdToken(token?: string): string | undefined {
  if (!token) return undefined
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      email?: string
      preferred_username?: string
    }
    return payload.email || payload.preferred_username
  } catch {
    return undefined
  }
}

async function postToken(endpoint: string, params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params
  })
  const body = (await response.json()) as TokenResponse
  if (!response.ok || body.error || !body.access_token) {
    throw new Error(body.error_description || body.error || `OAuth 服务返回 HTTP ${response.status}`)
  }
  return body
}

async function createLoopbackCallback(
  expectedState: string,
  hostname: OAuthProviderConfig['loopbackHost'],
  callbackPath: string
): Promise<{
  redirectUri: string
  waitForCode: Promise<string>
  close: () => void
}> {
  let server: Server
  let resolveCode: (code: string) => void
  let rejectCode: (error: Error) => void
  const waitForCode = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  server = createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${hostname}`)
      if (url.pathname !== callbackPath) {
        response.writeHead(404).end()
        return
      }
      if (url.searchParams.get('state') !== expectedState) throw new Error('OAuth state 校验失败')
      const oauthError = url.searchParams.get('error')
      if (oauthError) throw new Error(`授权被取消：${oauthError}`)
      const code = url.searchParams.get('code')
      if (!code) throw new Error('OAuth 回调缺少授权码')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(
        '<!doctype html><meta charset="utf-8"><title>OmniMail</title><style>body{font-family:system-ui;margin:64px;background:#f8fafc;color:#0f172a}main{max-width:520px;margin:auto;padding:32px;background:white;border-radius:18px;box-shadow:0 12px 32px #0f172a18}</style><main><h1>授权成功</h1><p>你可以关闭此页面并返回 OmniMail。</p></main>'
      )
      resolveCode(code)
    } catch (error) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('授权失败，请返回 OmniMail 查看详情。')
      rejectCode(error as Error)
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, hostname, resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('无法启动 OAuth 本地回调')

  const timeout = setTimeout(() => rejectCode(new Error('OAuth 授权超时，请重试')), 5 * 60_000)
  timeout.unref()
  waitForCode.finally(() => clearTimeout(timeout)).catch(() => undefined)

  return {
    redirectUri: `http://${hostname}:${address.port}${callbackPath === '/' ? '' : callbackPath}`,
    waitForCode,
    close: () => server.close()
  }
}

export class OAuthService {
  private readonly pending = new Map<string, PendingAuthorization>()

  constructor(
    private readonly vault: SecretVault,
    private readonly configuredClientIds: OAuthClientIds
  ) {}

  async authorize(raw: OAuthRequest): Promise<OAuthResult> {
    const request = validateOAuth(raw)
    const provider = CONFIG[request.provider]
    const clientId = request.clientId || this.configuredClientIds[request.provider]
    if (!clientId) {
      throw new Error('此构建尚未配置该服务商的 OAuth 客户端，请使用应用专用密码或展开开发者选项')
    }
    const state = base64Url(randomBytes(24))
    const verifier = base64Url(randomBytes(48))
    const challenge = base64Url(createHash('sha256').update(verifier).digest())
    const callback = await createLoopbackCallback(state, provider.loopbackHost, provider.callbackPath)
    try {
      const authorizeUrl = new URL(provider.authorizationEndpoint)
      authorizeUrl.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callback.redirectUri,
        response_type: 'code',
        scope: provider.scope,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
        login_hint: request.email
      }).toString()
      await shell.openExternal(authorizeUrl.toString(), { activate: true })
      const code = await callback.waitForCode
      const params = new URLSearchParams({
        client_id: clientId,
        code,
        redirect_uri: callback.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier
      })
      if (request.clientSecret) params.set('client_secret', request.clientSecret)
      const token = await postToken(provider.tokenEndpoint, params)
      const expiresAt = Date.now() + Math.max(token.expires_in ?? 3600, 60) * 1000
      const handle = randomUUID()
      const email = emailFromIdToken(token.id_token) || request.email
      this.pending.set(handle, {
        credential: {
          kind: 'oauth2',
          accessToken: token.access_token!,
          refreshToken: token.refresh_token,
          expiresAt,
          clientId,
          clientSecret: request.clientSecret,
          tokenEndpoint: provider.tokenEndpoint,
          scope: token.scope || provider.scope
        },
        email,
        expiresAt: Date.now() + 10 * 60_000
      })
      return { handle, email, expiresAt }
    } finally {
      callback.close()
    }
  }

  consume(handle: string): PendingAuthorization {
    const pending = this.pending.get(handle)
    this.pending.delete(handle)
    if (!pending || pending.expiresAt < Date.now()) throw new Error('OAuth 授权已过期，请重新授权')
    return pending
  }

  async getValidCredential(account: AccountRecord): Promise<OAuthCredential> {
    const credential = await this.vault.get(account.id)
    if (credential.kind !== 'oauth2') throw new Error('账户凭据类型不匹配')
    if (credential.expiresAt > Date.now() + 60_000) return credential
    if (!credential.refreshToken) throw new Error('OAuth 授权已过期，请删除账户后重新授权')

    const params = new URLSearchParams({
      client_id: credential.clientId,
      refresh_token: credential.refreshToken,
      grant_type: 'refresh_token',
      scope: credential.scope
    })
    if (credential.clientSecret) params.set('client_secret', credential.clientSecret)
    const token = await postToken(credential.tokenEndpoint, params)
    const refreshed: OAuthCredential = {
      ...credential,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token || credential.refreshToken,
      expiresAt: Date.now() + Math.max(token.expires_in ?? 3600, 60) * 1000,
      scope: token.scope || credential.scope
    }
    await this.vault.set(account.id, refreshed)
    return refreshed
  }
}
