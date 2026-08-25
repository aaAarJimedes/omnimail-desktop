# 邮箱提供商配置

服务商设置可能调整。若下列入口名称与当前网页不一致，请以服务商账户安全中心的实际界面为准；不要向任何人提供网页登录密码或 OAuth 令牌。

## QQ 邮箱

1. 登录 QQ 邮箱网页，进入“设置/账户”或“账户与安全”。
2. 开启 IMAP/SMTP 服务并按提示验证身份。
3. 生成客户端授权码。
4. 在 OmniMail 输入完整邮箱地址，识别为“QQ 邮箱”后填写授权码。向导中的按钮可以直接打开 QQ 邮箱网页。

默认服务器：

- IMAP：`imap.qq.com:993`，TLS
- SMTP：`smtp.qq.com:465`，TLS

常见问题：填写 QQ 密码会失败；授权码失效后需重新生成并重新添加账户。

## 网易 163

1. 登录 163 邮箱网页并进入 POP3/SMTP/IMAP 设置。
2. 开启 IMAP/SMTP 服务。
3. 按提示设置或生成客户端授权密码。
4. 在 OmniMail 输入完整邮箱地址，识别为“网易 163”后填写客户端授权密码。向导中的按钮可以直接打开网易邮箱网页。

默认服务器：

- IMAP：`imap.163.com:993`，TLS
- SMTP：`smtp.163.com:465`，TLS

## Gmail / Google Workspace

### OAuth 2.0（推荐）

构建者需要在 Google Cloud 项目中配置 OAuth 同意屏幕，创建“桌面应用”客户端，并启用所需 Gmail 范围。构建前设置 `OMNIMAIL_GOOGLE_CLIENT_ID`；最终用户随后只需在系统浏览器中登录，不需要填写客户端 ID。

未配置客户端 ID 的开发构建仍可展开“使用自己的 OAuth 客户端”，临时填写开发者自己的客户端 ID。不要复制其他软件的客户端 ID。

OmniMail 请求 `openid`、`email` 和 `https://mail.google.com/`，使用 PKCE 与 loopback 回调。未发布/未验证的 OAuth 应用可能只允许测试用户登录。

### 应用专用密码

若账户启用了两步验证且组织允许应用专用密码，可选择该方式。不要填写普通 Google 密码。

默认服务器：

- IMAP：`imap.gmail.com:993`，TLS
- SMTP：`smtp.gmail.com:465`，TLS

## Outlook / Microsoft 365

需要在 Microsoft Entra / Azure 中注册公共客户端：

1. 创建应用注册并记录 Application (client) ID。
2. 添加“移动和桌面应用”平台、配置系统浏览器重定向 `http://localhost`，并启用公共客户端流。
3. 添加委托权限 `IMAP.AccessAsUser.All` 与 `SMTP.Send`。
4. 根据租户策略完成用户或管理员同意。
5. 构建前设置 `OMNIMAIL_MICROSOFT_CLIENT_ID`。最终用户在 OmniMail 输入邮箱地址后，只需在系统浏览器中完成登录。

默认服务器：

- IMAP：`outlook.office365.com:993`，TLS
- SMTP：`smtp.office365.com:587`，STARTTLS

组织管理员可能禁用 SMTP AUTH；这种情况下即使 OAuth 成功也无法通过 SMTP 发信，需要管理员为账户启用该功能或等待未来的 Microsoft Graph 发信实现。

## EDU / 学校邮箱

OmniMail 会先查询邮箱域名的公开 MX 记录。若识别为 Google Workspace 或 Microsoft 365，将自动切换到对应的浏览器 OAuth 登录。查询失败不会阻止添加账户。

也可以根据学校说明判断托管方式：

- 登录页和帮助文档指向 Google Workspace：按 Gmail 方式添加。
- 指向 Microsoft 365 / Outlook：按 Outlook 方式添加。
- 学校自建系统：向信息中心获取 IMAP/SMTP 主机、端口、TLS 模式和客户端授权密码。

自建邮箱通常使用 IMAP 993；SMTP 可能使用隐式 TLS 465 或 STARTTLS 587。OmniMail 的“教育邮箱”配置中可以手动填写这些值。

## 连接失败排查

- 确认填的是完整邮箱地址，而不是仅用户名。
- 确认使用授权码/应用专用密码，而不是网页登录密码。
- 检查 IMAP、SMTP 或 SMTP AUTH 是否被账户/组织策略禁用。
- 校准系统时间；OAuth 和 TLS 对时间偏差敏感。
- 校园网可能阻断 993、465 或 587 端口，可换网络验证。
- 不要关闭 TLS 证书验证来规避错误；应联系服务商修复证书或服务器配置。
