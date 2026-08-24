import {
  Archive,
  ChevronDown,
  FileText,
  Inbox,
  MailPlus,
  Plus,
  SendHorizontal,
  Star,
  Trash2
} from 'lucide-react'
import type { AccountRecord, FolderInfo } from '@shared/types'

interface Props {
  accounts: AccountRecord[]
  selectedAccountId: string
  selectedMailbox: string
  folders: FolderInfo[]
  onSelectAccount(id: string): void
  onSelectMailbox(path: string): void
  onAddAccount(): void
  onCompose(): void
  onRemoveAccount(account: AccountRecord): void
}

function folderIcon(specialUse?: string): React.JSX.Element {
  switch (specialUse) {
    case '\\Sent':
      return <SendHorizontal size={17} />
    case '\\Drafts':
      return <FileText size={17} />
    case '\\Trash':
      return <Trash2 size={17} />
    case '\\Archive':
      return <Archive size={17} />
    case '\\Flagged':
      return <Star size={17} />
    default:
      return <Inbox size={17} />
  }
}

function folderLabel(folder: FolderInfo): string {
  const labels: Record<string, string> = {
    '\\Inbox': '收件箱',
    '\\Sent': '已发送',
    '\\Drafts': '草稿箱',
    '\\Trash': '已删除',
    '\\Archive': '归档',
    '\\Junk': '垃圾邮件',
    '\\Flagged': '已加星标'
  }
  return (folder.specialUse && labels[folder.specialUse]) || folder.name
}

export function Sidebar(props: Props): React.JSX.Element {
  const {
    accounts,
    selectedAccountId,
    selectedMailbox,
    folders,
    onSelectAccount,
    onSelectMailbox,
    onAddAccount,
    onCompose,
    onRemoveAccount
  } = props

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><span /></div>
        <div><strong>OmniMail</strong><small>统一邮箱</small></div>
      </div>

      <button className="compose-button" disabled={!accounts.length} onClick={onCompose}>
        <MailPlus size={18} /> 写邮件
      </button>

      <nav className="sidebar-nav">
        <p className="nav-label">邮箱</p>
        <button
          className={`nav-row ${selectedAccountId === 'all' ? 'active' : ''}`}
          onClick={() => onSelectAccount('all')}
        >
          <span className="account-dot all-accounts">∞</span>
          <span className="nav-copy"><strong>统一收件箱</strong><small>{accounts.length} 个账户</small></span>
          <ChevronDown size={15} />
        </button>

        <div className="account-list">
          {accounts.map((account) => (
            <div className={`account-row-wrap ${selectedAccountId === account.id ? 'active' : ''}`} key={account.id}>
              <button className="nav-row account-row" onClick={() => onSelectAccount(account.id)}>
                <span className="account-dot" style={{ background: account.color }}>{account.displayName.slice(0, 1).toUpperCase()}</span>
                <span className="nav-copy"><strong>{account.displayName}</strong><small>{account.email}</small></span>
              </button>
              <button className="remove-account" onClick={() => onRemoveAccount(account)} title="删除账户">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button className="add-account-button" onClick={onAddAccount}><Plus size={16} /> 添加邮箱</button>

        {selectedAccountId !== 'all' && folders.length > 0 && (
          <div className="folder-list">
            <p className="nav-label">文件夹</p>
            {folders.map((folder) => (
              <button
                key={folder.path}
                className={`folder-row ${selectedMailbox === folder.path ? 'active' : ''}`}
                onClick={() => onSelectMailbox(folder.path)}
              >
                {folderIcon(folder.specialUse)}
                <span>{folderLabel(folder)}</span>
                {Boolean(folder.unread) && <em>{folder.unread}</em>}
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <ShieldBadge />
        <span><strong>本地加密</strong><small>凭据不离开设备</small></span>
      </div>
    </aside>
  )
}

function ShieldBadge(): React.JSX.Element {
  return <span className="shield-badge">✓</span>
}
