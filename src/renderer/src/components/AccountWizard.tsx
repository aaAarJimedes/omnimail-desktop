import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Search,
  ShieldCheck,
  X
} from 'lucide-react'
import type {
  AccountRecord,
  AuthMode,
  OAuthProviderId,
  ProviderDefinition,
  ProviderId
} from '@shared/types'

interface Props {
  providers: ProviderDefinition[]
  oauthConfigured: Record<OAuthProviderId, boolean>
  onClose(): void
  onAdded(account: AccountRecord): void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AccountWizard({ providers, oauthConfigured, onClose, onAdded }: Props): React.JSX.Element {
  const [step, setStep] = useState<'email' | 'credentials'>('email')
  const [providerId, setProviderId] = useState<ProviderId>('gmail')
  const [discoverySource, setDiscoverySource] = useState<'address' | 'mx' | 'fallback'>('fallback')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('oauth2')
  const [password, setPassword] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState(false)
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('993')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('465')
  const [smtpSecure, setSmtpSecure] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const provider = useMemo(
    () => providers.find((item) => item.id === providerId) ?? providers[0]!,
    [providerId, providers]
  )
  const oauthProvider: OAuthProviderId | undefined =
    providerId === 'gmail' || providerId === 'outlook' ? providerId : undefined
  const bundledOAuth = oauthProvider ? oauthConfigured[oauthProvider] : false

  function applyProvider(id: ProviderId, source: 'address' | 'mx' | 'fallback'): void {
    const next = providers.find((item) => item.id === id)
    if (!next) throw new Error('无法识别邮箱服务商')
    setProviderId(id)
    setAuthMode(next.authModes[0]!)
    setDiscoverySource(source)
    setShowAdvancedOAuth(false)
    setPassword('')
    setClientId('')
    setClientSecret('')
    setStep('credentials')
    setError('')
  }

  async function discover(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await window.omnimail.discoverAccount(email)
      setEmail(result.email)
      applyProvider(result.provider, result.source)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function selectProvider(id: ProviderId): void {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('请先输入完整邮箱地址，再选择服务商')
      return
    }
    setEmail(email.trim())
    applyProvider(id, 'fallback')
  }

  async function openProviderHelp(): Promise<void> {
    if (providerId !== 'qq' && providerId !== '163') return
    setError('')
    try {
      await window.omnimail.openProviderHelp(providerId)
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      let oauthHandle: string | undefined
      if (authMode === 'oauth2') {
        if (!oauthProvider) {
          throw new Error('学校使用 Google 或 Microsoft 托管时，请选择对应提供商进行 OAuth 登录')
        }
        if (!bundledOAuth && !clientId.trim()) {
          throw new Error('此构建尚未配置 OAuth 客户端；请改用应用专用密码或展开开发者选项')
        }
        const oauth = await window.omnimail.authorizeOAuth({
          provider: oauthProvider,
          email,
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined
        })
        oauthHandle = oauth.handle
      }
      const account = await window.omnimail.addAccount({
        email,
        displayName,
        provider: providerId,
        authMode,
        username: email,
        password: authMode === 'password' ? password : undefined,
        oauthHandle,
        imap: provider.imap
          ? undefined
          : { host: imapHost, port: Number(imapPort), secure: true },
        smtp: provider.smtp
          ? undefined
          : { host: smtpHost, port: Number(smtpPort), secure: smtpSecure }
      })
      onAdded(account)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const detectionCopy = discoverySource === 'mx'
    ? `已根据域名的邮件服务记录识别为 ${provider.name}`
    : discoverySource === 'address'
      ? `已识别为 ${provider.name}`
      : `已手动选择 ${provider.name}`

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal account-wizard" role="dialog" aria-modal="true" aria-label="添加邮箱账户">
        <header className="modal-header">
          <div>
            <p className="eyebrow">快速连接</p>
            <h2>{step === 'email' ? '添加邮箱账户' : provider.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={19} />
          </button>
        </header>

        {step === 'email' ? (
          <form onSubmit={(event) => void discover(event)} className="wizard-content discovery-step">
            <div className="discovery-intro">
              <span className="discovery-icon"><Search size={22} /></span>
              <div>
                <strong>只需输入邮箱地址</strong>
                <p>OmniMail 会识别常见服务商，并通过域名自动判断学校邮箱是否由 Google 或 Microsoft 托管。</p>
              </div>
            </div>
            <label className="discovery-email-label">
              邮箱地址
              <div className="input-with-icon discovery-email-input">
                <Mail size={18} />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@university.edu.cn"
                />
              </div>
            </label>
            {error && <div className="error-banner">{error}</div>}
            <button className="primary-button discovery-button" disabled={busy} type="submit">
              {busy ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
              {busy ? '正在识别服务商…' : '自动识别并继续'}
            </button>

            <div className="manual-provider-divider"><span>也可以手动选择</span></div>
            <div className="provider-grid compact-provider-grid">
              {providers.map((item) => (
                <button className="provider-card" type="button" key={item.id} onClick={() => selectProvider(item.id)}>
                  <span className="provider-mark" style={{ background: item.accent }}>
                    {item.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="discovery-privacy">自动识别只查询邮箱域名的公开 MX 记录，不会发送用户名、密码或邮件内容。</p>
          </form>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="wizard-content account-form">
            <button type="button" className="back-button" onClick={() => { setStep('email'); setError('') }}>
              <ArrowLeft size={16} /> 更换邮箱或服务商
            </button>

            <div className="detected-account">
              <span className="provider-mark" style={{ background: provider.accent }}>{provider.name.slice(0, 1)}</span>
              <span><strong>{email}</strong><small>{detectionCopy}</small></span>
              <Check size={18} />
            </div>

            <label>
              发件人名称 <span className="label-hint">（可选）</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="显示给收件人的名称"
              />
            </label>

            {provider.authModes.length > 1 && (
              <div className="segmented auth-switch">
                {provider.authModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={authMode === mode ? 'active' : ''}
                    onClick={() => setAuthMode(mode)}
                  >
                    {mode === 'oauth2' ? '浏览器安全登录' : '应用专用密码'}
                  </button>
                ))}
              </div>
            )}

            {authMode === 'password' ? (
              <>
                <label>
                  授权码 / 应用专用密码
                  <div className="input-with-icon">
                    <LockKeyhole size={17} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="不是网页登录密码"
                    />
                  </div>
                </label>
                {(providerId === 'qq' || providerId === '163') && (
                  <button type="button" className="secondary-button provider-help-button" onClick={() => void openProviderHelp()}>
                    <ExternalLink size={16} /> 打开{provider.name}网页获取授权码
                  </button>
                )}
              </>
            ) : (
              <div className="oauth-login-card">
                <ShieldCheck size={22} />
                <div>
                  <strong>使用系统浏览器安全登录</strong>
                  <p>OmniMail 不会看到你的网页登录密码；授权完成后浏览器会自动返回应用。</p>
                  {bundledOAuth ? (
                    <span className="oauth-ready"><Check size={13} /> 此构建已配置一键登录</span>
                  ) : (
                    <>
                      <span className="oauth-not-ready">此开发构建尚未配置服务商客户端 ID</span>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setShowAdvancedOAuth((value) => !value)}
                      >
                        {showAdvancedOAuth ? '收起开发者选项' : '使用自己的 OAuth 客户端'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {authMode === 'oauth2' && !bundledOAuth && showAdvancedOAuth && (
              <div className="advanced-oauth-fields">
                <label>
                  OAuth 客户端 ID
                  <input required value={clientId} onChange={(event) => setClientId(event.target.value)} />
                </label>
                <label>
                  客户端密钥 <span className="label-hint">（桌面公共客户端通常留空）</span>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(event) => setClientSecret(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            )}

            {!provider.imap && (
              <div className="server-grid">
                <label>
                  IMAP 服务器
                  <input required value={imapHost} onChange={(event) => setImapHost(event.target.value)} />
                </label>
                <label>
                  IMAP 端口
                  <input required type="number" value={imapPort} onChange={(event) => setImapPort(event.target.value)} />
                </label>
                <label>
                  SMTP 服务器
                  <input required value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} />
                </label>
                <label>
                  SMTP 端口
                  <input required type="number" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} />
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={smtpSecure} onChange={(event) => setSmtpSecure(event.target.checked)} />
                  SMTP 使用隐式 TLS
                </label>
              </div>
            )}

            <p className="provider-help">{provider.help}</p>
            {error && <div className="error-banner">{error}</div>}
            <button
              className="primary-button submit-button"
              disabled={busy || (authMode === 'oauth2' && !bundledOAuth && !clientId.trim())}
              type="submit"
            >
              {busy ? <LoaderCircle className="spin" size={18} /> : authMode === 'oauth2' ? <ExternalLink size={18} /> : <Check size={18} />}
              {busy
                ? (authMode === 'oauth2' ? '等待浏览器授权并测试连接…' : '正在测试连接…')
                : (authMode === 'oauth2' ? '在浏览器中继续' : '连接并添加')}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
