import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, LoaderCircle, Plus, RefreshCw, WifiOff } from 'lucide-react'
import type { AccountRecord, AppSnapshot, FolderInfo, MessageDetail, MessageRef, MessageSummary } from '@shared/types'
import { AccountWizard } from './components/AccountWizard'
import { ComposeModal } from './components/ComposeModal'
import { MessageList } from './components/MessageList'
import { MessageReader } from './components/MessageReader'
import { Sidebar } from './components/Sidebar'

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<AppSnapshot>()
  const [selectedAccountId, setSelectedAccountId] = useState('all')
  const [selectedMailbox, setSelectedMailbox] = useState('INBOX')
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [selectedSummary, setSelectedSummary] = useState<MessageSummary>()
  const [detail, setDetail] = useState<MessageDetail>()
  const [query, setQuery] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showAccountWizard, setShowAccountWizard] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const accounts = snapshot?.accounts ?? []
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId)

  const showToast = useCallback((value: string) => {
    setToast(value)
    window.setTimeout(() => setToast(''), 3000)
  }, [])

  const loadMessages = useCallback(async () => {
    if (!snapshot?.accounts.length) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    setError('')
    try {
      const result = await window.omnimail.listMessages({
        accountIds: selectedAccountId === 'all' ? undefined : [selectedAccountId],
        mailbox: selectedAccountId === 'all' ? 'INBOX' : selectedMailbox,
        query,
        limit: 100
      })
      setMessages(result)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setLoadingMessages(false)
    }
  }, [query, selectedAccountId, selectedMailbox, snapshot?.accounts.length])

  useEffect(() => {
    window.omnimail
      .bootstrap()
      .then((value) => {
        setSnapshot(value)
        if (!value.accounts.length) setShowAccountWizard(true)
      })
      .catch((reason) => setError((reason as Error).message))
  }, [])

  useEffect(() => {
    if (!snapshot) return
    const timer = window.setTimeout(() => void loadMessages(), query ? 450 : 0)
    return () => window.clearTimeout(timer)
  }, [loadMessages, query, snapshot])

  useEffect(() => {
    setFolders([])
    if (selectedAccountId === 'all') return
    window.omnimail
      .listFolders(selectedAccountId)
      .then((items) => setFolders(items))
      .catch((reason) => setError((reason as Error).message))
  }, [selectedAccountId])

  useEffect(() =>
    window.omnimail.onSyncProgress((progress) => {
      if (progress.phase === 'error' && progress.message) setError(progress.message)
    }), [])

  async function selectMessage(message: MessageSummary): Promise<void> {
    setSelectedSummary(message)
    setLoadingDetail(true)
    setError('')
    try {
      const next = await window.omnimail.getMessage(message)
      setDetail(next)
      if (message.unread) {
        setMessages((current) => current.map((item) => item.key === message.key ? { ...item, unread: false } : item))
        void window.omnimail.setRead(message, true).catch(() => undefined)
      }
    } catch (reason) {
      setError((reason as Error).message)
      setDetail(undefined)
    } finally {
      setLoadingDetail(false)
    }
  }

  function selectAccount(id: string): void {
    setSelectedAccountId(id)
    setSelectedMailbox('INBOX')
    setSelectedSummary(undefined)
    setDetail(undefined)
  }

  async function refresh(): Promise<void> {
    setSyncing(true)
    setError('')
    try {
      const result = await window.omnimail.sync(selectedAccountId === 'all' ? undefined : [selectedAccountId])
      setMessages(result.filter((message) => selectedAccountId === 'all' || message.mailbox === selectedMailbox))
      showToast('同步完成')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  async function toggleFlag(message: MessageSummary): Promise<void> {
    const flagged = !message.flagged
    setMessages((current) => current.map((item) => item.key === message.key ? { ...item, flagged } : item))
    if (detail?.key === message.key) setDetail({ ...detail, flagged })
    try {
      await window.omnimail.setFlagged(message, flagged)
    } catch (reason) {
      setError((reason as Error).message)
      void loadMessages()
    }
  }

  async function deleteSelected(): Promise<void> {
    if (!detail || !window.confirm('确定永久删除这封邮件吗？此操作由邮箱服务器执行。')) return
    try {
      await window.omnimail.deleteMessage(detail)
      setMessages((current) => current.filter((item) => item.key !== detail.key))
      setDetail(undefined)
      setSelectedSummary(undefined)
      showToast('邮件已删除')
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  async function removeAccount(account: AccountRecord): Promise<void> {
    if (!window.confirm(`从本机移除 ${account.email}？服务器上的邮件不会被删除。`)) return
    try {
      await window.omnimail.removeAccount(account.id)
      setSnapshot((current) => current ? { ...current, accounts: current.accounts.filter((item) => item.id !== account.id) } : current)
      if (selectedAccountId === account.id) selectAccount('all')
      setMessages((current) => current.filter((message) => message.accountId !== account.id))
      showToast('账户已从本机移除')
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  async function saveAttachment(ref: MessageRef, index: number): Promise<void> {
    try {
      const saved = await window.omnimail.saveAttachment(ref, index)
      if (saved) showToast(`附件已保存到 ${saved}`)
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  const title = useMemo(() => {
    if (selectedAccountId === 'all') return '统一收件箱'
    const folder = folders.find((item) => item.path === selectedMailbox)
    return folder?.name || selectedMailbox
  }, [folders, selectedAccountId, selectedMailbox])

  if (!snapshot) {
    return (
      <main className="splash-screen">
        <div className="brand-mark large"><span /></div>
        <h1>OmniMail</h1>
        <LoaderCircle className="spin" size={22} />
        {error && <p>{error}</p>}
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Sidebar
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        selectedMailbox={selectedMailbox}
        folders={folders}
        onSelectAccount={selectAccount}
        onSelectMailbox={(mailbox) => { setSelectedMailbox(mailbox); setDetail(undefined); setSelectedSummary(undefined) }}
        onAddAccount={() => setShowAccountWizard(true)}
        onCompose={() => setShowCompose(true)}
        onRemoveAccount={(account) => void removeAccount(account)}
      />

      {accounts.length ? (
        <>
          <MessageList
            messages={messages}
            accounts={accounts}
            selectedKey={selectedSummary?.key}
            loading={loadingMessages}
            query={query}
            title={title}
            onQueryChange={setQuery}
            onSelect={(message) => void selectMessage(message)}
            onToggleFlag={(message) => void toggleFlag(message)}
          />
          <MessageReader
            message={detail}
            account={accounts.find((account) => account.id === detail?.accountId)}
            loading={loadingDetail}
            onToggleFlag={() => detail && void toggleFlag(detail)}
            onDelete={() => void deleteSelected()}
            onReply={() => setShowCompose(true)}
            onSaveAttachment={(ref, index) => void saveAttachment(ref, index)}
          />
          <button className="refresh-button" onClick={() => void refresh()} disabled={syncing} title="同步邮件">
            <RefreshCw className={syncing ? 'spin' : ''} size={17} /> {syncing ? '同步中' : '同步'}
          </button>
        </>
      ) : (
        <section className="no-accounts">
          <div className="no-accounts-art"><span>＠</span></div>
          <p className="eyebrow">欢迎使用 OmniMail</p>
          <h1>把所有邮箱，收进一个安静的地方</h1>
          <p>统一管理 QQ、163、Outlook、Gmail 和学校邮箱。邮件直接与服务商同步，凭据仅保存在你的设备。</p>
          <button className="primary-button" onClick={() => setShowAccountWizard(true)}><Plus size={18} /> 添加第一个邮箱</button>
          <div className="feature-pills"><span>IMAP / SMTP</span><span>OAuth 2.0</span><span>本地加密</span></div>
        </section>
      )}

      {error && (
        <div className="global-error"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError('')}>×</button></div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {!navigator.onLine && <div className="offline-banner"><WifiOff size={15} /> 当前处于离线状态，将显示本地缓存</div>}

      {showAccountWizard && (
        <AccountWizard
          providers={snapshot.providers}
          onClose={() => setShowAccountWizard(false)}
          onAdded={(account) => {
            setSnapshot((current) => current ? { ...current, accounts: [...current.accounts, account] } : current)
            setShowAccountWizard(false)
            selectAccount(account.id)
            showToast(`${account.email} 已连接`)
          }}
        />
      )}
      {showCompose && accounts.length > 0 && (
        <ComposeModal
          accounts={accounts}
          initialAccountId={selectedAccount?.id}
          onClose={() => setShowCompose(false)}
          onSent={showToast}
        />
      )}
    </main>
  )
}
