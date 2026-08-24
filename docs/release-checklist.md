# 发布检查清单

## 功能

- [ ] 使用测试账户验证 QQ 授权码收信和发信
- [ ] 使用测试账户验证 163 授权密码收信和发信
- [ ] 使用测试 OAuth 应用验证 Gmail 授权、刷新、收信和发信
- [ ] 使用测试租户验证 Outlook 授权、刷新、收信和发信
- [ ] 使用自建/EDU 测试服务器验证手动 IMAP/SMTP 配置
- [ ] 验证统一收件箱、文件夹、搜索、已读、星标、移动和删除
- [ ] 验证发信附件与下载附件

真实服务商端到端验证需要维护者控制的测试账户与 OAuth 应用，CI 不保存这些凭据。

## 自动化

- [ ] `npm ci`
- [ ] `npm audit` 输出 0 个漏洞
- [ ] `npm run check`
- [ ] `OMNIMAIL_SMOKE_TEST=1 electron .` 输出 `OMNIMAIL_SMOKE_OK`
- [ ] `npm run package`
- [ ] 对 NSIS 和 Portable 文件记录 SHA-256

## 安全

- [ ] 未提交 `.env`、邮箱地址、授权码、令牌、客户端密钥或邮件样本
- [ ] `sandbox`、`contextIsolation`、`nodeIntegration`、CSP 与导航白名单未弱化
- [ ] 邮件 HTML 和附件边界测试通过
- [ ] Windows 二进制完成代码签名（公开正式发行时）

## GitHub

- [ ] 工作树只包含本项目文件
- [ ] 标签与 `package.json` 版本一致
- [ ] CI 通过
- [ ] Release notes 包含已知限制与未签名提示
- [ ] 上传安装包、便携版和 SHA-256 校验文件
