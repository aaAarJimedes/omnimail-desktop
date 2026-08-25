# Changelog

## 0.2.0 - 2026-08-25

- 添加账户改为邮箱地址优先的两步向导
- 通过公开 MX 记录自动识别 Google Workspace 与 Microsoft 365 托管域名
- 支持在构建阶段配置 Google / Microsoft 公共客户端 ID，最终用户无需填写
- OAuth 登录明确使用系统浏览器，并保留开发者高级客户端配置回退
- QQ / 163 增加官方网页快捷入口，减少授权码获取路径查找
- 自动发现、OAuth 配置和输入边界增加单元测试

## 0.1.0 - 2026-08-24

首个公开版本：

- QQ、163、Gmail、Outlook、EDU 与自定义 IMAP/SMTP 账户
- 密码授权和 Gmail/Outlook OAuth 2.0 + PKCE
- 统一收件箱、文件夹、同步、搜索、阅读、星标、移动和删除
- SMTP 发信与安全附件选择/保存
- 系统安全存储、HTML 邮件隔离和 IPC 白名单
- Windows NSIS 安装包与便携版构建配置
