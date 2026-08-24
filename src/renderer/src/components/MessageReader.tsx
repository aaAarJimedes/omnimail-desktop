import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Archive, Download, LoaderCircle, MailOpen, Paperclip, Reply, Star, Trash2 } from 'lucide-react'
import type { AccountRecord, MessageDetail, MessageRef } from '@shared/types'

interface Props {
  message?: MessageDetail
  account?: AccountRecord
  loading: boolean
  onToggleFlag(): void
  onDelete(): void
  onReply(): void
  onSaveAttachment(ref: MessageRef, index: number): void
}

function senderLabel(message: MessageDetail): string {
  const sender = message.from[0]
  return sender?.name || sender?.address || '未知发件人'
}

function safeEmailDocument(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'form', 'input', 'button', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'svg', 'math'],
    FORBID_ATTR: ['style', 'srcset', 'background', 'formaction'],
    ALLOW_DATA_ATTR: false
  })
  const document = new DOMParser().parseFromString(clean, 'text/html')
  document.querySelectorAll('img').forEach((image) => {
    image.removeAttribute('src')
    image.setAttribute('alt', image.getAttribute('alt') || '[远程图片已阻止]')
  })
  document.querySelectorAll('a').forEach((anchor) => {
    anchor.removeAttribute('href')
    anchor.removeAttribute('target')
  })
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid:"><style>html{color:#253047;background:#fff;font:15px/1.68 system-ui,sans-serif}body{margin:0;overflow-wrap:anywhere}img{max-width:100%;height:auto}blockquote{border-left:3px solid #cbd5e1;margin-left:0;padding-left:16px;color:#64748b}table{max-width:100%}pre{white-space:pre-wrap}a{color:#2563eb;text-decoration:underline;cursor:not-allowed}</style></head><body>${document.body.innerHTML}</body></html>`
}

export function MessageReader(props: Props): React.JSX.Element {
  const { message, account, loading, onToggleFlag, onDelete, onReply, onSaveAttachment } = props
  const safeDocument = useMemo(() => (message?.html ? safeEmailDocument(message.html) : ''), [message?.html])

  if (loading) {
    return <section className="reader empty-reader"><LoaderCircle className="spin" size={26} /><span>正在安全加载邮件…</span></section>
  }
  if (!message) {
    return (
      <section className="reader empty-reader">
        <div className="empty-reader-illustration"><MailOpen size={34} /></div>
        <h2>选择一封邮件开始阅读</h2>
        <p>OmniMail 会隔离邮件内容并阻止远程图片，保护你的阅读隐私。</p>
      </section>
    )
  }

  const ref = { accountId: message.accountId, mailbox: message.mailbox, uid: message.uid }
  return (
    <section className="reader">
      <div className="reader-toolbar">
        <div className="toolbar-group">
          <button onClick={onReply}><Reply size={17} /> 回复</button>
          <button title="归档功能需选择目标文件夹"><Archive size={17} /></button>
        </div>
        <div className="toolbar-group">
          <button className={message.flagged ? 'active' : ''} onClick={onToggleFlag}><Star size={17} fill={message.flagged ? 'currentColor' : 'none'} /></button>
          <button className="danger" onClick={onDelete}><Trash2 size={17} /></button>
        </div>
      </div>
      <article className="reader-content">
        <header className="reader-header">
          <div className="reader-account"><span style={{ background: account?.color }} />{account?.email}</div>
          <h1>{message.subject}</h1>
          <div className="sender-line">
            <span className="large-avatar" style={{ background: account?.color }}>{senderLabel(message).slice(0, 1).toUpperCase()}</span>
            <div><strong>{senderLabel(message)}</strong><small>&lt;{message.from[0]?.address}&gt; 发给 {message.to.map((item) => item.address).join(', ')}</small></div>
            <time>{new Date(message.date).toLocaleString('zh-CN')}</time>
          </div>
        </header>
        {message.html ? (
          <iframe className="email-frame" title="邮件正文" sandbox="" referrerPolicy="no-referrer" srcDoc={safeDocument} />
        ) : (
          <pre className="plain-email">{message.text}</pre>
        )}
        {message.attachments.length > 0 && (
          <section className="reader-attachments">
            <h3><Paperclip size={16} /> {message.attachments.length} 个附件</h3>
            <div>
              {message.attachments.map((attachment) => (
                <button key={attachment.index} onClick={() => onSaveAttachment(ref, attachment.index)}>
                  <span><strong>{attachment.filename}</strong><small>{attachment.contentType} · {Math.ceil(attachment.size / 1024)} KB</small></span>
                  <Download size={17} />
                </button>
              ))}
            </div>
          </section>
        )}
      </article>
    </section>
  )
}
