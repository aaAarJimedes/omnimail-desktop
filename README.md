# OmniMail Desktop

OmniMail 是一款本地优先的多账户桌面邮箱客户端，用一个界面管理 QQ、网易 163、Outlook / Microsoft 365、Gmail / Google Workspace、学校教育邮箱及其他标准 IMAP / SMTP 邮箱。

> 当前版本：`0.1.0`。这是可构建、可运行的开源首版；OAuth 客户端 ID 需要由构建者或用户自行申请，项目不会内置他人的密钥。

## 已实现功能

- 多邮箱账户添加、连通性测试与安全移除
- 统一收件箱，以及单账户文件夹浏览
- IMAP 同步、服务端搜索、本地摘要缓存
- 邮件阅读、已读状态、星标、移动与删除
- SMTP 发信、抄送/密送、多个附件
- 附件安全选择令牌与另存为
- Gmail / Outlook OAuth 2.0 + PKCE、本地回调、刷新令牌
- QQ / 163 授权码和 Gmail 应用专用密码
- 自定义 IMAP / SMTP，适配常见 EDU 邮箱
- 远程图片默认阻止，HTML 邮件经过净化并在无权限 iframe 中隔离
- 凭据使用 Electron `safeStorage` 调用 Windows DPAPI / 系统密钥环加密

## 提供商兼容性

| 提供商 | 收信 | 发信 | 登录方式 | 备注 |
|---|---:|---:|---|---|
| QQ 邮箱 | IMAP | SMTP | 授权码 | 需在网页设置中开启 IMAP/SMTP |
| 网易 163 | IMAP | SMTP | 客户端授权密码 | 不能填写网页登录密码 |
| Gmail / Workspace | IMAP | SMTP | OAuth 2.0 或应用专用密码 | OAuth 需 Google 桌面应用客户端 ID |
| Outlook / Microsoft 365 | IMAP | SMTP | OAuth 2.0 | 需 Azure 公共客户端 ID 和委托权限 |
| EDU 邮箱 | IMAP | SMTP | 授权码/应用密码 | 学校使用 Google/Microsoft 托管时选择对应提供商 |
| 其他邮箱 | IMAP | SMTP | 密码/授权码 | 服务器须支持标准协议和 TLS |

更完整的配置步骤见 [邮箱提供商配置](docs/provider-setup.md)。

## 开发与运行

要求：

- Windows 10/11
- Node.js 24+
- npm 11+
- Git
- GitHub CLI（仅发布仓库时需要）

```powershell
npm ci
npm run dev
```

验证与构建：

```powershell
npm run check
npm run package
```

仅生成用于本机验收的展开目录（不下载 NSIS/WinCodeSign）：

```powershell
npm run package:dir
```

构建产物默认写入 `release/`：

- `OmniMail-Setup-0.1.0-x64.exe`：NSIS 安装包
- `OmniMail-Portable-0.1.0-x64.exe`：免安装便携版

## 数据存储

运行时数据保存在 Electron 的 `userData` 目录，Windows 默认位于 `%APPDATA%/OmniMail` 附近：

- `accounts.json`：不含密钥的账户元数据
- `secrets.json`：由系统安全存储加密后的凭据
- `message-cache.json`：最多 3,000 条邮件摘要，不缓存附件

移除账户会删除该账户的本地凭据和摘要缓存，不会删除服务器上的邮箱账户。

## 安全设计

- 渲染进程：`sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`
- IPC：只暴露逐项白名单方法，并验证调用页面与输入参数
- 邮件 HTML：DOMPurify 净化、移除链接行为和远程图片、空 sandbox iframe
- TLS：IMAP/SMTP 强制证书验证和 TLS 1.2+
- OAuth：PKCE、随机 `state`、127.0.0.1 临时回调、短时一次性授权句柄
- 附件：渲染层不能提交任意本地路径，只能使用主进程签发的一次性令牌
- 依赖：锁文件固定版本，CI 执行类型检查、测试与生产构建

详细威胁模型见 [架构说明](docs/architecture.md) 和 [安全策略](SECURITY.md)。

## 当前限制

- 项目不附带已注册的 Google / Microsoft OAuth 应用，因此首次添加 OAuth 账户需要提供客户端 ID。
- 邮件规则、日历、联系人、S/MIME、PGP 和 Exchange ActiveSync 尚未实现。
- 离线缓存目前保存邮件摘要；完整正文仍在打开邮件时按需从服务器获取。
- 自动发现尚未接入 DNS SRV / autoconfig；未知 EDU 邮箱需手动填写服务器信息。
- Windows 构建未进行代码签名，首次运行可能出现 SmartScreen 提示。

## 项目结构

```text
src/main/       Electron 主进程、IMAP/SMTP/OAuth、加密存储
src/preload/    最小权限 IPC 桥
src/renderer/   React 桌面界面
src/shared/     跨进程类型、提供商目录和验证
tests/          单元与安全边界测试
docs/           架构与提供商配置文档
```

## 许可证

[MIT](LICENSE)
