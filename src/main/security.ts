export function isTrustedRendererUrl(rawUrl: string, devServerUrl = process.env['VITE_DEV_SERVER_URL']): boolean {
  try {
    const url = new URL(rawUrl)
    if (
      url.protocol === 'omnimail:' &&
      url.hostname === 'app' &&
      !url.username &&
      !url.password &&
      !url.port
    ) {
      return true
    }
    if (!devServerUrl) return false
    const dev = new URL(devServerUrl)
    if (!['http:', 'https:'].includes(dev.protocol)) return false
    return url.origin === dev.origin
  } catch {
    return false
  }
}
