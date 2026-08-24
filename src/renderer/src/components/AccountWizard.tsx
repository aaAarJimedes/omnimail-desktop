import { useMemo, useState } from 'react'
import { ArrowLeft, Check, LoaderCircle, LockKeyhole, Mail, ShieldCheck, X } from 'lucide-react'
import { detectProvider } from '@shared/providers'
import type { AccountRecord, AuthMode, ProviderDefinition, ProviderId } from '@shared/types'

interface Props {
  providers: ProviderDefinition[]
  onClose(): void
  onAdded(account: AccountRecord): void
}

export function AccountWizard({ providers, onClose, onAdded }: Props): React.JSX.Element {
  const [step, setStep] = useState<'provider' | 'credentials'>('provider')
  const [providerId, setProviderId] = useState<ProviderId>('qq')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('password')
  const [password, setPassword] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
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

  function selectProvider(id: ProviderId): void {
    const next = providers.find((item) => item.id === id)!
    setProviderId(id)
    setAuthMode(next.authModes[0]!)
    setStep('credentials')
    setError('')
  }

  function inferProvider(): void {
    const detected = detectProvider(email)
    if (detected !== 'custom') {
      const next = providers.find((item) => item.id === detected)
      if (next) {
        setProviderId(detected)
        setAuthMode(next.authModes[0]!)
      }
    }
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      let oauthHandle: string | undefined
      if (authMode === 'oauth2') {
        if (providerId !== 'gmail' && providerId !== 'outlook') {
          throw new Error('学校使用 Google 或 Microsoft 托管时，请选择对应提供商进行 OAuth 登录')
        }
        const oauth = await window.omnimail.authorizeOAuth({
          provider: providerId,
          email,
          clientId,
          clientSecret: clientSecret || undefined
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
        oauthClientId: clientId || undefined,
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

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal account-wizard" role="dialog" aria-modal="true" aria-label="添加邮箱账户">
        <header className="modal-header">
          <div>
            <p className="eyebrow">安全连接</p>
            <h2>{step === 'provider' ? '添加邮箱账户' : provider.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={19} />
          </button>
        </header>

        {step === 'provider' ? (
          <div className="wizard-content">
            <p className="muted">选择邮箱服务商。所有邮件直接在本机与服务商通信，不经过 OmniMail 服务器。</p>
            <div className="provider-grid">
              {providers.map((item) => (
                <button className="provider-card" key={item.id} onClick={() => selectProvider(item.id)}>
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
            <div className="security-note">
              <ShieldCheck size={19} />
              <span>凭据由操作系统安全存储加密；应用不记录明文密码和 OAuth 令牌。</span>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="wizard-content account-form">
            <button type="button" className="back-button" onClick={() => setStep('provider')}>
              <ArrowLeft size={16} /> 更换服务商
            </button>
            <label>
              邮箱地址
              <div className="input-with-icon">
                <Mail size={17} />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={inferProvider}
                  placeholder="name@example.com"
                />
              </div>
            </label>
            <label>
              发件人名称
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
                    {mode === 'oauth2' ? 'OAuth 2.0' : '应用专用密码'}
                  </button>
                ))}
              </div>
            )}

            {authMode === 'password' ? (
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
                  />
                </div>
              </label>
            ) : (
              <>
                <label>
                  OAuth 客户端 ID
                  <input required value={clientId} onChange={(event) => setClientId(event.target.value)} />
                </label>
                <label>
                  客户端密钥 <span className="label-hint">（桌面应用如不需要可留空）</span>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(event) => setClientSecret(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              </>
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
            <button className="primary-button submit-button" disabled={busy} type="submit">
              {busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
              {busy ? (authMode === 'oauth2' ? '等待授权并测试连接…' : '正在测试连接…') : '连接并添加'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
