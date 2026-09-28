import { exists, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { hostname } from '@tauri-apps/plugin-os';
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

let cachedMachine: string | null = null;

export async function getMachineName(): Promise<string> {
  if (cachedMachine) return cachedMachine;
  try {
    cachedMachine = (await hostname()) ?? 'desconhecido';
  } catch {
    cachedMachine = 'desconhecido';
  }
  return cachedMachine;
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

export function isLockStale(lock: LockInfo): boolean {
  return Date.now() - new Date(lock.heartbeat).getTime() > LOCK_STALE_MS;
}

export function isSameHolder(lock: LockInfo, user: CurrentUser, machine: string): boolean {
  return lock.user_email === user.email && lock.machine === machine;
}

// Projetos em processo de fechamento: o heartbeat não pode reescrever o lock
// depois que closeProject o apagou (a batida que já tinha lido o arquivo
// antes da remoção recriaria um lock órfão).
const closing = new Set<string>();

export function markClosing(dbFile: string): void {
  closing.add(dbFile);
}

export function unmarkClosing(dbFile: string): void {
  closing.delete(dbFile);
}

export type HeartbeatResult = 'ok' | 'lost';

// Atualiza só o timestamp, e só se o lock ainda é deste usuário+máquina.
// 'lost' = outra pessoa reivindicou o projeto (nosso lock ficou obsoleto,
// ex.: notebook dormiu) — não sobrescreve o lock dela. No-op se o lock não
// existir mais: o heartbeat não recria um lock que já foi solto.
export async function touchHeartbeat(dbFile: string, user: CurrentUser): Promise<HeartbeatResult> {
  if (closing.has(dbFile)) return 'ok';
  const machine = await getMachineName();
  const lock = await readLock(dbFile);
  if (!lock) return 'ok';
  if (!isSameHolder(lock, user, machine)) return 'lost';
  if (closing.has(dbFile)) return 'ok';
  await writeLock(dbFile, { ...lock, heartbeat: new Date().toISOString() });
  return 'ok';
}

// Só apaga se o lock for nosso — se alguém reivindicou o projeto enquanto
// estávamos fora, o lock é dela.
export async function releaseLockIfOwned(dbFile: string, user: CurrentUser): Promise<void> {
  const machine = await getMachineName();
  const lock = await readLock(dbFile);
  if (!lock || !isSameHolder(lock, user, machine)) return;
  await remove(await getLockPath(dbFile));
}

export class LockLostError extends Error {
  constructor(public readonly holder: LockInfo) {
    super(`O projeto foi assumido por ${holder.user_name} (${holder.machine}).`);
    this.name = 'LockLostError';
  }
}

// Garante que o lock ainda é nosso antes de publicar por cima do canônico.
// Lock ausente (ex.: apagado à mão) passa: ninguém mais o detém, e o sync o
// grava de novo no fim.
export async function assertLockOwned(dbFile: string, user: CurrentUser): Promise<void> {
  const machine = await getMachineName();
  const lock = await readLock(dbFile);
  if (lock && !isSameHolder(lock, user, machine)) throw new LockLostError(lock);
}

// Lock de outra pessoa, ainda válido — usado pra bloquear operações
// destrutivas feitas pela lista de projetos (renomear/excluir).
export async function activeForeignLock(dbFile: string, user: CurrentUser): Promise<LockInfo | null> {
  const machine = await getMachineName();
  const lock = await readLock(dbFile);
  if (!lock || isSameHolder(lock, user, machine) || isLockStale(lock)) return null;
  return lock;
}
