import { safeStorage } from 'electron'
import path from 'node:path'
import { JsonStore } from './json-store'

export interface PasswordCredential {
  kind: 'password'
  password: string
}

export interface OAuthCredential {
  kind: 'oauth2'
  accessToken: string
  refreshToken?: string
  expiresAt: number
  clientId: string
  clientSecret?: string
  tokenEndpoint: string
  scope: string
}

export type StoredCredential = PasswordCredential | OAuthCredential

interface SecretData {
  version: 1
  encrypted: Record<string, string>
}

export class SecretVault {
  private readonly store: JsonStore<SecretData>

  constructor(userDataPath: string) {
    this.store = new JsonStore(path.join(userDataPath, 'secrets.json'), () => ({ version: 1, encrypted: {} }))
  }

  private assertAvailable(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统安全存储当前不可用，OmniMail 不会以明文保存邮箱密码')
    }
  }

  async set(accountId: string, credential: StoredCredential): Promise<void> {
    this.assertAvailable()
    const encrypted = safeStorage.encryptString(JSON.stringify(credential)).toString('base64')
    const data = await this.store.read()
    await this.store.write({ ...data, encrypted: { ...data.encrypted, [accountId]: encrypted } })
  }

  async get(accountId: string): Promise<StoredCredential> {
    this.assertAvailable()
    const value = (await this.store.read()).encrypted[accountId]
    if (!value) throw new Error('未找到该账户的安全凭据，请重新添加账户')
    try {
      return JSON.parse(safeStorage.decryptString(Buffer.from(value, 'base64'))) as StoredCredential
    } catch {
      throw new Error('凭据无法解密，可能是系统用户或安全存储已变化')
    }
  }

  async remove(accountId: string): Promise<void> {
    const data = await this.store.read()
    const encrypted = { ...data.encrypted }
    delete encrypted[accountId]
    await this.store.write({ ...data, encrypted })
  }
}
