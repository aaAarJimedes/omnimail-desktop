import type { ProviderDefinition, ProviderId } from './types'

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'qq',
    name: 'QQ 邮箱',
    description: '使用 QQ 邮箱授权码连接',
    accent: '#12b7f5',
    imap: { host: 'imap.qq.com', port: 993, secure: true },
    smtp: { host: 'smtp.qq.com', port: 465, secure: true },
    authModes: ['password'],
    help: '请先在 QQ 邮箱网页设置中开启 IMAP/SMTP，并生成授权码。这里填写授权码，不是 QQ 密码。'
  },
  {
    id: '163',
    name: '网易 163',
    description: '使用客户端授权密码连接',
    accent: '#e5484d',
    imap: { host: 'imap.163.com', port: 993, secure: true },
    smtp: { host: 'smtp.163.com', port: 465, secure: true },
    authModes: ['password'],
    help: '请在 163 邮箱设置中启用 IMAP/SMTP 服务，并填写客户端授权密码。'
  },
  {
    id: 'outlook',
    name: 'Outlook / Microsoft 365',
    description: 'OAuth 2.0 安全登录',
    accent: '#2563eb',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    authModes: ['oauth2'],
    help: '需要 Azure 应用的公共客户端 ID。应用需允许移动和桌面流，并授予 IMAP.AccessAsUser.All 与 SMTP.Send 委托权限。'
  },
  {
    id: 'gmail',
    name: 'Gmail / Google Workspace',
    description: 'OAuth 2.0 或应用专用密码',
    accent: '#ea4335',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    authModes: ['oauth2', 'password'],
    help: '推荐 OAuth 2.0。开发版需填写 Google 桌面应用客户端 ID；也可在启用两步验证后使用应用专用密码。'
  },
  {
    id: 'edu',
    name: '教育邮箱',
    description: '适配学校自建、Google Workspace 或 Microsoft 365',
    accent: '#7c3aed',
    authModes: ['password'],
    help: '请向学校信息中心确认 IMAP/SMTP 地址与端口。若学校使用 Gmail 或 Microsoft 365，请选择对应提供商。'
  },
  {
    id: 'custom',
    name: '其他邮箱',
    description: '任何标准 IMAP / SMTP 邮箱',
    accent: '#64748b',
    authModes: ['password'],
    help: '填写邮箱服务商提供的 IMAP 和 SMTP 地址、端口及授权密码。'
  }
]

export function getProvider(id: ProviderId): ProviderDefinition {
  const provider = PROVIDERS.find((item) => item.id === id)
  if (!provider) throw new Error(`不支持的邮箱提供商：${id}`)
  return provider
}

export function detectProvider(email: string): ProviderId {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (domain === 'qq.com' || domain === 'foxmail.com') return 'qq'
  if (domain === '163.com' || domain === '126.com' || domain === 'yeah.net') return '163'
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) return 'outlook'
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail'
  if (domain.endsWith('.edu') || domain.endsWith('.edu.cn')) return 'edu'
  return 'custom'
}
