import { LoaderCircle, Paperclip, Search, Star } from 'lucide-react'
import type { AccountRecord, MessageSummary } from '@shared/types'

interface Props {
  messages: MessageSummary[]
  accounts: AccountRecord[]
  selectedKey?: string
  loading: boolean
  query: string
  title: string
  onQueryChange(value: string): void
  onSelect(message: MessageSummary): void
  onToggleFlag(message: MessageSummary): void
}

function contact(message: MessageSummary): string {
  const first = message.from[0]
  return first?.name || first?.address || '未知发件人'
}

function initials(value: string): string {
  return value.trim().slice(0, 1).toUpperCase() || '?'
}

function displayDate(value: string): string {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  return date.toLocaleDateString('zh-CN', { year: '2-digit', month: 'numeric', day: 'numeric' })
}

export function MessageList(props: Props): React.JSX.Element {
  const { messages, accounts, selectedKey, loading, query, title, onQueryChange, onSelect, onToggleFlag } = props
  const accountMap = new Map(accounts.map((account) => [account.id, account]))

  return (
    <section className="message-column">
      <header className="message-column-header">
        <div><p className="eyebrow">邮件</p><h1>{title}</h1></div>
        <span className="message-count">{messages.length}</span>
      </header>
      <label className="search-box">
        <Search size={17} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索主题、发件人或正文" />
        {loading && <LoaderCircle className="spin" size={16} />}
      </label>
      <div className="message-list">
        {!loading && messages.length === 0 && (
          <div className="empty-list"><div>✦</div><strong>这里很安静</strong><span>{query ? '没有匹配的邮件' : '暂无邮件，试试刷新'}</span></div>
        )}
        {messages.map((message) => {
          const sender = contact(message)
          const account = accountMap.get(message.accountId)
          return (
            <article
              key={message.key}
              className={`message-card ${selectedKey === message.key ? 'selected' : ''} ${message.unread ? 'unread' : ''}`}
              onClick={() => onSelect(message)}
            >
              <span className="sender-avatar" style={{ background: account?.color }}>{initials(sender)}</span>
              <div className="message-card-copy">
                <div className="message-card-top"><strong>{sender}</strong><time>{displayDate(message.date)}</time></div>
                <h3>{message.subject}</h3>
                <p>{message.preview || '打开邮件查看内容'}</p>
                <div className="message-meta">
                  {account && <span style={{ color: account.color }}>{account.displayName}</span>}
                  {message.hasAttachments && <Paperclip size={13} />}
                </div>
              </div>
              <button
                className={`star-button ${message.flagged ? 'active' : ''}`}
                onClick={(event) => { event.stopPropagation(); onToggleFlag(message) }}
                aria-label={message.flagged ? '取消星标' : '添加星标'}
              >
                <Star size={16} fill={message.flagged ? 'currentColor' : 'none'} />
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
