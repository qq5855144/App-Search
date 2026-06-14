export function getCurrentDevicePlatform(): string {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('android')) return 'Android'
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'iOS'
    if (ua.includes('macintosh') || ua.includes('mac os')) return 'macOS'
    if (ua.includes('windows')) return 'Windows'
    if (ua.includes('linux')) return 'Linux'
  }
  if (typeof process !== 'undefined' && process.env?.EXPO_OS) {
    return process.env.EXPO_OS === 'ios' ? 'iOS' : process.env.EXPO_OS === 'android' ? 'Android' : 'Web'
  }
  return 'Web'
}

export function getDownloadUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/releases`
}

export function getVersionDownloadUrl(owner: string, repo: string, tag: string): string {
  return `https://github.com/${owner}/${repo}/releases/tag/${tag}`
}
