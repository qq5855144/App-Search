import { Platform } from 'react-native'
import { setGitHubToken } from './github'

const TOKEN_KEY = 'github_pat'

// SecureStore 在 Web 端不可用，使用 localStorage 作为 fallback
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key)
    }
    // 动态导入，避免 Web 端模块加载时崩溃
    const SecureStore = await import('expo-secure-store')
    return SecureStore.getItemAsync(key)
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
      return
    }
    const SecureStore = await import('expo-secure-store')
    await SecureStore.setItemAsync(key, value)
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
      return
    }
    const SecureStore = await import('expo-secure-store')
    await SecureStore.deleteItemAsync(key)
  },
}

export async function saveToken(token: string): Promise<void> {
  await storage.setItem(TOKEN_KEY, token)
  await setGitHubToken(token)
}

export async function getToken(): Promise<string | null> {
  return storage.getItem(TOKEN_KEY)
}

export async function clearToken(): Promise<void> {
  await storage.deleteItem(TOKEN_KEY)
  await setGitHubToken(null)
}

export async function initToken(): Promise<void> {
  const token = await getToken()
  await setGitHubToken(token)
}
