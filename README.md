# OmniMail Desktop

OmniMail 是一款本地优先的多账户桌面邮箱客户端，用一个界面管理 QQ、网易 163、Outlook / Microsoft 365、Gmail / Google Workspace、学校教育邮箱及其他标准 IMAP / SMTP 邮箱。

> 当前版本：`0.2.0`。添加账户采用“邮箱地址优先”：自动识别服务商和学校域名托管方式；构建者配置 OAuth 客户端后，最终用户不需要填写客户端 ID。

## 已实现功能

- 多邮箱账户添加、连通性测试与安全移除
- 邮箱地址优先的添加向导，以及 Google Workspace / Microsoft 365 MX 自动识别
- 统一收件箱，以及单账户文件夹浏览
- IMAP 同步、服务端搜索、本地摘要缓存
- 邮件阅读、已读状态、星标、移动与删除
- SMTP 发信、抄送/密送、多个附件
- 附件安全选择令牌与另存为
- Gmail / Outlook 系统浏览器 OAuth 2.0 + PKCE、本地回调、刷新令牌
- QQ / 163 授权码快捷入口和 Gmail 应用专用密码
- 自定义 IMAP / SMTP，适配常见 EDU 邮箱
- 远程图片默认阻止，HTML 邮件经过净化并在无权限 iframe 中隔离
- 凭据使用 Electron `safeStorage` 调用 Windows DPAPI / 系统密钥环加密

## 提供商兼容性

| 提供商 | 收信 | 发信 | 登录方式 | 备注 |
|---|---:|---:|---|---|
| QQ 邮箱 | IMAP | SMTP | 授权码 | 需在网页设置中开启 IMAP/SMTP |
| 网易 163 | IMAP | SMTP | 客户端授权密码 | 不能填写网页登录密码 |
| Gmail / Workspace | IMAP | SMTP | OAuth 2.0 或应用专用密码 | 已配置的构建可一键浏览器登录 |
| Outlook / Microsoft 365 | IMAP | SMTP | OAuth 2.0 | 已配置的构建可一键浏览器登录 |
| EDU 邮箱 | IMAP | SMTP | OAuth/授权码/应用密码 | 自动识别 Google 或 Microsoft 托管域名 |
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

若要让最终用户直接使用 Google / Microsoft 一键登录，请在启动开发环境或生产构建前设置公共桌面客户端 ID：

```powershell
$env:OMNIMAIL_GOOGLE_CLIENT_ID = "your-google-desktop-client-id"
$env:OMNIMAIL_MICROSOFT_CLIENT_ID = "your-microsoft-public-client-id"
npm run build
```

客户端 ID 会编入应用且不是密码；桌面公共客户端不应依赖客户端密钥。未配置时，开发者仍可在添加向导的高级选项中临时填写自己的客户端 ID。

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

- `OmniMail-Setup-0.2.0-x64.exe`：NSIS 安装包
- `OmniMail-Portable-0.2.0-x64.exe`：免安装便携版

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

- 仓库不冒用第三方 OAuth 应用；正式发行者需注册并在构建时配置自己的 Google / Microsoft 公共客户端 ID。
- 邮件规则、日历、联系人、S/MIME、PGP 和 Exchange ActiveSync 尚未实现。
- 离线缓存目前保存邮件摘要；完整正文仍在打开邮件时按需从服务器获取。
- 自动发现目前覆盖已知邮箱域名和 Google/Microsoft MX 托管识别；其他自建 EDU 邮箱仍需填写服务器信息。
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
