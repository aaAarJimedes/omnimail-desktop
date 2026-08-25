# OmniMail 架构与安全模型

## 目标

OmniMail 把不同服务商的邮箱抽象为统一的 IMAP 收信和 SMTP 发信能力，同时尽量缩小处理不可信邮件内容的权限范围。系统不依赖中转服务器，账户直接连接到各自邮箱服务商。

## 进程边界

```text
React 渲染器（不可信内容展示）
        │ 逐项、参数化 IPC
        ▼
Preload contextBridge（最小白名单）
        │
        ▼
Electron 主进程
 ├─ AccountStore：非敏感账户元数据
 ├─ AccountDiscovery：地址规则与公开 MX 托管识别
 ├─ SecretVault：safeStorage 加密凭据
 ├─ OAuthService：PKCE、令牌交换与刷新
 ├─ MailService：IMAPFlow + Nodemailer
 └─ MessageCache：有界邮件摘要缓存
        │
        ▼ TLS 1.2+
邮箱服务商 IMAP / SMTP / OAuth 端点
```

渲染器不能访问 Node.js、Electron、文件系统或任意 IPC 通道。Preload 仅暴露 `OmniMailApi` 中定义的方法；主进程对每个 IPC 调用再次验证来源和参数。

## 账户生命周期

1. 用户先输入邮箱地址；已知域名直接识别，EDU/自定义域名仅查询公开 MX 记录以判断 Google 或 Microsoft 托管，失败时回退到手动配置。
2. 授权码账户把密码一次性发给主进程；OAuth 账户使用 PKCE 打开系统浏览器，并由 loopback 临时端口接收回调（Google 使用 `127.0.0.1`，Microsoft 使用 `localhost`）。
3. 主进程创建账户元数据，并使用 `safeStorage.encryptString` 加密凭据。
4. 应用立刻执行 IMAP 连通性测试。失败时回滚账户和凭据，不留下半配置记录。
5. 删除账户时同时删除加密凭据和本地邮件摘要。

## 邮件同步

- 每个账户建立短生命周期 IMAP 连接，操作完成后登出。
- 列表同步默认取当前文件夹最近 100 封，单次上限 300。
- 服务端搜索覆盖主题、发件人和正文；已取回摘要还可在本地搜索。
- 缓存以 `accountId + mailbox + uid` 为稳定键，按日期保留最近 3,000 条。
- 正文与附件按需获取，不持久化到摘要缓存。

这种实现优先保证凭据隔离和可理解性。后续版本可增加连接池、IMAP IDLE、增量 UID 游标和加密全文索引。

## HTML 邮件威胁模型

邮件正文由攻击者控制，因此按不可信网页处理：

- DOMPurify 移除脚本、表单、iframe、object、SVG、MathML、样式和事件属性。
- 删除链接的 `href/target`，防止阅读时误跳转。
- 删除图片 `src/srcset/background`，默认阻止跟踪像素和外部请求。
- 净化结果写入没有权限的 `sandbox=""` iframe。
- iframe 内再次设置 `default-src 'none'` CSP 和 `no-referrer`。

## 文件系统边界

渲染器不能传入附件绝对路径。用户通过原生文件对话框选择文件后，主进程生成随机、限时、一次性附件令牌。发信只能消费这些令牌。下载附件由主进程重新获取并通过原生另存为对话框写入用户选择的位置。

## OAuth 注意事项

- 客户端 ID 是公开应用标识，可通过构建环境编入正式发行包；仓库不提交已注册的具体值，也绝不把客户端密钥当作桌面应用秘密。
- Google 桌面应用和 Microsoft 公共客户端应配置 loopback / 移动桌面回调能力。
- `state` 和 PKCE verifier 每次随机生成。
- OAuth 句柄只在主进程内存保存十分钟，访问令牌不会返回渲染器。
- 刷新令牌和可选客户端密钥随账户凭据一起加密。

## 已知边界

- `safeStorage` 的安全性取决于操作系统用户会话；已控制该用户会话的攻击者仍可能调用系统解密能力。
- IMAP/SMTP 服务商的服务器行为与保留策略不由客户端控制。
- 未签名 Windows 二进制不能提供发布者身份保证；正式分发应增加代码签名和可复现发布流程。
