import * as SecureStore from 'expo-secure-store'
import { setGitHubToken } from './github'

const TOKEN_KEY = 'github_pat'

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await setGitHubToken(token)
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await setGitHubToken(null)
}

export async function initToken(): Promise<void> {
  const token = await getToken()
  await setGitHubToken(token)
}
