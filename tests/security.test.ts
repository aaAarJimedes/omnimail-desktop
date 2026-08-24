import { describe, expect, it } from 'vitest'
import { isTrustedRendererUrl } from '../src/main/security'

describe('renderer URL trust boundary', () => {
  it.each([
    'omnimail://app/index.html',
    'omnimail://app/assets/index.js',
    'omnimail://app/folder/message'
  ])('accepts packaged application URL %s', (url) => {
    expect(isTrustedRendererUrl(url, undefined)).toBe(true)
  })

  it.each([
    'https://evil.example/',
    'omnimail://evil/index.html',
    'omnimail://app.evil.example/index.html',
    'file:///C:/secret.txt',
    'javascript:alert(1)',
    '',
    'not a url'
  ])('rejects untrusted production URL %s', (url) => {
    expect(isTrustedRendererUrl(url, undefined)).toBe(false)
  })

  it('requires an exact development origin instead of a string prefix', () => {
    const dev = 'http://127.0.0.1:5173/'
    expect(isTrustedRendererUrl('http://127.0.0.1:5173/src/main.tsx', dev)).toBe(true)
    expect(isTrustedRendererUrl('http://127.0.0.1:51730/attack', dev)).toBe(false)
    expect(isTrustedRendererUrl('http://127.0.0.1:5173.evil.example/attack', dev)).toBe(false)
  })
})
