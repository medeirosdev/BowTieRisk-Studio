import { exists, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import type { CurrentUser } from '../store/currentUserStore';
import { getLockPath } from './paths';

// Parâmetros do heartbeat (about.md, Seção 6.3): batida a cada 30s; lock
// considerado obsoleto após 3 min sem batida (~6 batidas perdidas — margem
// para o atraso de sync do SharePoint).
export const HEARTBEAT_BEAT_MS = 30_000;
export const LOCK_STALE_MS = 180_000;

export interface LockInfo {
  user_name: string;
  user_email: string;
  machine: string;
  acquired_at: string;
  heartbeat: string;
}

export async function readLock(dbFile: string): Promise<LockInfo | null> {
  const path = await getLockPath(dbFile);
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readTextFile(path)) as LockInfo;
  } catch {
    return null;
  }
}

export async function writeLock(dbFile: string, info: LockInfo): Promise<void> {
  const path = await getLockPath(dbFile);
  await writeTextFile(path, JSON.stringify(info, null, 2));
}

// Atualiza só o timestamp do heartbeat, preservando o resto do lock.
// No-op silencioso se o lock não existir mais (ex.: foi liberado em outra
// aba/instância) — o heartbeat não deve recriar um lock que já foi solto.
export async function touchHeartbeat(dbFile: string): Promise<void> {
  const lock = await readLock(dbFile);
  if (!lock) return;
  await writeLock(dbFile, { ...lock, heartbeat: new Date().toISOString() });
}

export async function releaseLock(dbFile: string): Promise<void> {
  const path = await getLockPath(dbFile);
  if (await exists(path)) {
    await remove(path);
  }
}

export function isLockStale(lock: LockInfo): boolean {
  return Date.now() - new Date(lock.heartbeat).getTime() > LOCK_STALE_MS;
}

export function isSameHolder(lock: LockInfo, user: CurrentUser, machine: string): boolean {
  return lock.user_email === user.email && lock.machine === machine;
}
