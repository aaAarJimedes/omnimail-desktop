import { useState } from 'react'
import { LoaderCircle, Paperclip, Send, X } from 'lucide-react'
import type { AccountRecord, PickedAttachment } from '@shared/types'

interface Props {
  accounts: AccountRecord[]
  initialAccountId?: string
  onClose(): void
  onSent(message: string): void
}

function splitAddresses(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function ComposeModal({ accounts, initialAccountId, onClose, onSent }: Props): React.JSX.Element {
  const [accountId, setAccountId] = useState(initialAccountId || accounts[0]?.id || '')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<PickedAttachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(): Promise<void> {
    try {
      const selected = await window.omnimail.pickAttachments()
      setAttachments((current) => [...current, ...selected].slice(0, 20))
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await window.omnimail.sendMessage({
        accountId,
        to: splitAddresses(to),
        cc: splitAddresses(cc),
        subject,
        text: body,
        attachmentTokens: attachments.map((item) => item.token)
      })
      onSent('邮件已发送')
      onClose()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop compose-backdrop">
      <form className="modal compose-modal" onSubmit={submit}>
        <header className="modal-header compose-header">
          <div>
            <p className="eyebrow">新邮件</p>
            <h2>撰写邮件</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={19} />
          </button>
        </header>
        <div className="compose-fields">
          <label className="compose-line">
            <span>发件人</span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName} &lt;{account.email}&gt;
                </option>
              ))}
            </select>
          </label>
          <label className="compose-line">
            <span>收件人</span>
            <input required value={to} onChange={(event) => setTo(event.target.value)} placeholder="多个地址用逗号分隔" />
          </label>
          <label className="compose-line">
            <span>抄送</span>
            <input value={cc} onChange={(event) => setCc(event.target.value)} />
          </label>
          <label className="compose-line">
            <span>主题</span>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <textarea
            className="compose-body"
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="写点什么…"
          />
          {attachments.length > 0 && (
            <div className="attachment-chips">
              {attachments.map((item) => (
                <button
                  type="button"
                  key={item.token}
                  onClick={() => setAttachments((current) => current.filter((entry) => entry.token !== item.token))}
                  title="点击移除"
                >
                  <Paperclip size={14} /> {item.name} <small>{Math.ceil(item.size / 1024)} KB</small>
                </button>
              ))}
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}
        </div>
        <footer className="compose-footer">
          <button type="button" className="secondary-button" onClick={pick}>
            <Paperclip size={17} /> 添加附件
          </button>
          <button className="primary-button" disabled={busy || !accountId} type="submit">
            {busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
            {busy ? '发送中…' : '发送'}
          </button>
        </footer>
      </form>
    </div>
  )
}
