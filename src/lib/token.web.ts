// Web 平台：直接用 localStorage，完全不引用 expo-secure-store
import { setGitHubToken } from './github';

const TOKEN_KEY = 'github_pat';

export async function saveToken(token: string): Promise<void> {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
  await setGitHubToken(token);
}

export async function getToken(): Promise<string | null> {
  try { const token = localStorage.getItem(TOKEN_KEY); await setGitHubToken(token); return token; } catch { await setGitHubToken(null); return null; }
}

export async function clearToken(): Promise<void> {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  await setGitHubToken(null);
}

export async function initToken(): Promise<void> {
  const token = await getToken();
  await setGitHubToken(token);
}
