# Security Policy

## Supported versions

安全修复目前仅维护最新的 `main` 分支和最新发布版本。

## Reporting a vulnerability

请不要在公开 Issue 中披露可利用细节。通过 GitHub 仓库的 Security Advisories / “Report a vulnerability” 私密报告功能提交：

- 受影响版本与平台
- 可复现步骤或最小 PoC
- 影响范围
- 建议修复（如有）

维护者会尽快确认报告、评估影响并协调修复与披露时间。

## Security guarantees and non-guarantees

OmniMail：

- 不运营邮件中转服务器；
- 使用系统安全存储加密本地凭据；
- 不在日志中主动记录密码、访问令牌或完整邮件正文；
- 默认阻止邮件中的远程图片和可执行内容。

OmniMail 不能在操作系统用户会话已经被攻破时保护凭据，也不能保证第三方邮箱服务商、网络或邮件发送者的安全性。

## Dependency handling

提交前执行：

```powershell
npm audit
npm run check
```

依赖漏洞修复不得以关闭 TLS、沙箱、上下文隔离、CSP 或输入验证为代价。
