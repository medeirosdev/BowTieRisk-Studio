import { join } from '@tauri-apps/api/path';
import { copyFile, exists, mkdir, readDir, remove, rename } from '@tauri-apps/plugin-fs';
import type Database from '@tauri-apps/plugin-sql';
// Fonte única do schema: o mesmo SQL que roda como migration no Rust
// (src-tauri/src/lib.rs) é aplicado aqui ao criar um banco por projeto,
// já que cada projeto tem um nome de arquivo dinâmico (about.md, Seção 6.6)
// e o mecanismo de `add_migrations` do plugin funciona por identificador fixo.
import schemaSql from '../../../src-tauri/migrations/001_initial.sql?raw';
import type { CurrentUser } from '../../store/currentUserStore';
import type { Project } from '../../types/domain';
import { writeAudit } from '../audit';
import { seedDefaultCategories } from './categoryRepo';
import { getProjectNotice } from './projectNoticeRepo';
import type { ProjectNotice } from './projectNoticeRepo';
import { LATEST_SCHEMA_VERSION, migrateProjectDb, setSchemaVersion } from '../migrations';
import { closeDbAt, getDbAt } from '../client';
import { appendProjectIndexEntry, ProjectIndexEntry, readProjectIndex, removeProjectIndexEntry, updateProjectIndexEntry } from '../indexFile';
import { newId } from '../ids';
import {
  activeForeignLock,
  assertLockOwned,
  getMachineName,
  isLockStale,
  isSameHolder,
  LockInfo,
  markClosing,
  readLock,
  releaseLockIfOwned,
  unmarkClosing,
  writeLock,
} from '../lockRepo';
import { getBackupsDir, getBancosDir, getWorkingDbPath, getWorkingDir } from '../paths';
import { fileMtimeMs, readChangeCounter, recordCleanWorkingCopy, stashWorkingCopy, workingCopyStatus } from '../workingCopy';
import { slugify } from '../slug';

const MAX_BACKUPS_PER_PROJECT = 30;

export interface OpenProject {
  id: string;
  name: string;
  dbFile: string;
  dbPath: string; // cópia de trabalho (ou o canônico, se readOnly) — usado pelos repositórios
  canonicalPath: string; // bancos/<arquivo>.db
  readOnly: boolean;
  lockOwner: LockInfo | null; // preenchido quando readOnly (quem está editando)
  reclaimedStaleLockFrom: string | null; // nome de quem tinha o lock obsoleto reivindicado (about.md, Seção 6.3: "com aviso")
  openedCanonicalMtimeMs: number | null; // pra detectar divergência inesperada no sync
  lastSyncAt: string | null;
  notice: ProjectNotice | null; // aviso geral do projeto, exibido em todas as telas dele
  recovery: WorkingCopyRecovery | null; // o que aconteceu com edições não sincronizadas de uma sessão anterior
}

// Edições que ficaram só na cópia de trabalho numa sessão anterior (app
// fechou sem sincronizar): 'resumed' = o canônico não mudou desde então e o
// lock é nosso, então a cópia foi reaproveitada como está; 'stashed' = não
// dava pra reaproveitar (outra pessoa editou/está editando), então foi
// guardada em `path` antes de ser substituída pelo canônico.
export type WorkingCopyRecovery = { kind: 'resumed' } | { kind: 'stashed'; path: string };

export class ProjectLockedError extends Error {
  constructor(public readonly holder: LockInfo) {
    super(`Projeto em uso por ${holder.user_name}.`);
    this.name = 'ProjectLockedError';
  }
}

export async function listProjects(): Promise<ProjectIndexEntry[]> {
  return readProjectIndex();
}

// Só resolve o caminho do arquivo — não abre conexão nem toca no audit_log.
// Usado por operações que precisam do dbPath sem que isso conte como um
// "OPEN" de verdade (ex.: renomear a partir da lista de projetos).
export async function resolveProjectDbPath(entry: ProjectIndexEntry): Promise<string> {
  const dir = await getBancosDir();
  return join(dir, entry.db_file);
}

export async function getProject(dbPath: string, projectId: string): Promise<Project> {
  const db = await getDbAt(dbPath);
  const [project] = await db.select<Project[]>('SELECT * FROM projects WHERE id = $1', [projectId]);
  if (!project) {
    throw new Error(`Projeto não encontrado: ${projectId}`);
  }
  return project;
}

// Leitura pontual do canônico pela lista de projetos (ex.: descrição pro
// formulário de renomear) — fecha a conexão logo em seguida, pra não deixar
// bancos/ aberto (about.md, Seção 6.4) nem uma conexão em cache que o
// próximo sync/abertura reaproveitaria sobre um arquivo já substituído.
export async function readProjectDetails(entry: ProjectIndexEntry): Promise<Project> {
  const dbPath = await resolveProjectDbPath(entry);
  try {
    return await getProject(dbPath, entry.id);
  } finally {
    await closeDbAt(dbPath);
  }
}

async function uniqueDbFileName(dir: string, base: string): Promise<string> {
  let candidate = `${base}.db`;
  let n = 2;
  while (await exists(await join(dir, candidate))) {
    candidate = `${base}-${n}.db`;
    n += 1;
  }
  return candidate;
}

// Sincroniza o usuário atual na tabela `users` do projeto (não é
// autenticação — about.md, Seção 9 — é o registro de quem já mexeu neste
// banco). Roda na abertura e na criação do projeto.
async function touchProjectUser(db: Database, user: CurrentUser): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.select<{ id: string }[]>('SELECT id FROM users WHERE email = $1', [user.email]);
  if (existing.length > 0) {
    await db.execute('UPDATE users SET name = $1, last_seen = $2 WHERE id = $3', [user.name, now, existing[0].id]);
  } else {
    await db.execute(
      'INSERT INTO users (id, name, email, first_seen, last_seen) VALUES ($1, $2, $3, $4, $4)',
      [newId(), user.name, user.email, now],
    );
  }
}

async function ensureWorkingDir(): Promise<void> {
  const workingDir = await getWorkingDir();
  if (!(await exists(workingDir))) {
    await mkdir(workingDir, { recursive: true });
  }
}

// Prepara a cópia de trabalho local a partir de bancos/<projeto>.db (about.md,
// Seção 6.3). Fecha qualquer conexão antiga antes de mexer nos arquivos
// (Seção 6.4: nunca copiar com conexão aberta) — inclusive no canônico, que
// pode ter ficado com uma conexão em cache (ex.: leitura feita pela lista de
// projetos).
//
// Se a cópia existente tem edições nunca sincronizadas (workingCopy.ts), ela
// não é simplesmente sobrescrita: é reaproveitada quando dá (lock nosso e
// canônico intacto desde que ela foi feita), senão guardada em
// backups/nao-sincronizados/ antes da cópia nova.
async function prepareWorkingCopy(
  projectId: string,
  dbFile: string,
  canonicalPath: string,
  canonicalCounter: number | null,
  canClaim: boolean,
): Promise<{ workingPath: string; recovery: WorkingCopyRecovery | null }> {
  await ensureWorkingDir();
  const workingPath = await getWorkingDbPath(projectId);
  await closeDbAt(workingPath);
  await closeDbAt(canonicalPath);

  const status = await workingCopyStatus(projectId, workingPath);
  if (status.dirty) {
    const canonicalUnchanged = canonicalCounter !== null && status.baseCanonicalCounter === canonicalCounter;
    if (canClaim && canonicalUnchanged) {
      return { workingPath, recovery: { kind: 'resumed' } };
    }
    const path = await stashWorkingCopy(workingPath, dbFile);
    await copyFile(canonicalPath, workingPath);
    return { workingPath, recovery: { kind: 'stashed', path } };
  }

  await copyFile(canonicalPath, workingPath);
  return { workingPath, recovery: null };
}

export async function createProject(name: string, description: string | null, user: CurrentUser): Promise<OpenProject> {
  const dir = await getBancosDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }

  const id = newId();
  const baseSlug = slugify(name) || `projeto-${id.slice(-6).toLowerCase()}`;
  const dbFile = await uniqueDbFileName(dir, baseSlug);
  const canonicalPath = await join(dir, dbFile);

  // Cria o schema já na cópia de trabalho e sincroniza pro canônico em
  // seguida — assim a criação passa pelo mesmo caminho de sync/backup que
  // qualquer outra alteração.
  const workingPath = await getWorkingDbPath(id);
  await ensureWorkingDir();
  await closeDbAt(workingPath);

  const db = await getDbAt(workingPath);
  await db.execute(schemaSql);
  await seedDefaultCategories(db, user);
  // schemaSql já é o schema final — nenhuma migração precisa rodar num banco novo.
  await setSchemaVersion(db, LATEST_SCHEMA_VERSION);

  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO projects (id, name, description, created_by, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, name, description, user.name, now],
  );
  await touchProjectUser(db, user);
  await writeAudit(db, user, { action: 'CREATE', entityType: 'project', entityId: id, entityLabel: name });

  unmarkClosing(dbFile);
  const machine = await getMachineName();
  await acquireLock(dbFile, user, machine);

  await closeDbAt(workingPath);
  await copyFile(workingPath, canonicalPath);
  // Por último: só entra na lista depois que o arquivo existe em bancos/ —
  // uma falha antes disso não deixa um item apontando pro nada.
  await appendProjectIndexEntry({ id, name, db_file: dbFile, created_by: user.name, created_at: now });
  await getDbAt(workingPath); // reabre pra edição contínua
  const openedCanonicalMtimeMs = await fileMtimeMs(canonicalPath);
  await recordCleanWorkingCopy(id, workingPath, await readChangeCounter(canonicalPath));

  return {
    id,
    name,
    dbFile,
    dbPath: workingPath,
    canonicalPath,
    readOnly: false,
    lockOwner: null,
    reclaimedStaleLockFrom: null,
    openedCanonicalMtimeMs,
    lastSyncAt: now,
    notice: null,
    recovery: null,
  };
}

async function acquireLock(dbFile: string, user: CurrentUser, machine: string): Promise<void> {
  const now = new Date().toISOString();
  await writeLock(dbFile, { user_name: user.name, user_email: user.email, machine, acquired_at: now, heartbeat: now });
}

export async function openProject(entry: ProjectIndexEntry, user: CurrentUser): Promise<OpenProject> {
  const dir = await getBancosDir();
  const canonicalPath = await join(dir, entry.db_file);
  const machine = await getMachineName();

  const lock = await readLock(entry.db_file);
  const stale = lock ? isLockStale(lock) : false;
  const sameHolder = lock ? isSameHolder(lock, user, machine) : false;
  const canClaim = !lock || stale || sameHolder;
  // Reivindicar um lock obsoleto de OUTRA pessoa exige aviso (about.md,
  // Seção 6.3) — reclamar o próprio lock (mesmo usuário+máquina) não conta.
  const reclaimedStaleLockFrom = lock && stale && !sameHolder ? lock.user_name : null;

  unmarkClosing(entry.db_file);
  const canonicalMtime = await fileMtimeMs(canonicalPath);
  const canonicalCounter = await readChangeCounter(canonicalPath);
  const { workingPath, recovery } = await prepareWorkingCopy(entry.id, entry.db_file, canonicalPath, canonicalCounter, canClaim);
  const db = await getDbAt(workingPath);
  // Traz bancos criados por versões anteriores do app pro schema atual. Roda
  // inclusive em somente leitura: só afeta a cópia de trabalho local, que
  // nunca volta pro canônico nesse modo.
  await migrateProjectDb(db, user);

  if (canClaim) {
    await acquireLock(entry.db_file, user, machine);
    await touchProjectUser(db, user);
    await writeAudit(db, user, { action: 'LOCK', entityType: 'project', entityId: entry.id, entityLabel: entry.name });
  }
  await writeAudit(db, user, { action: 'OPEN', entityType: 'project', entityId: entry.id, entityLabel: entry.name });
  // Cópia reaproveitada continua "suja" até o próximo sync — só marca como
  // limpa a que acabou de vir do canônico.
  if (recovery?.kind !== 'resumed') {
    await recordCleanWorkingCopy(entry.id, workingPath, canonicalCounter);
  }

  return {
    id: entry.id,
    name: entry.name,
    dbFile: entry.db_file,
    dbPath: workingPath,
    canonicalPath,
    readOnly: !canClaim,
    lockOwner: canClaim ? null : lock,
    reclaimedStaleLockFrom,
    openedCanonicalMtimeMs: canonicalMtime,
    lastSyncAt: null,
    notice: await getProjectNotice(workingPath, entry.id),
    recovery,
  };
}

export interface SyncResult {
  project: OpenProject;
  conflict: boolean;
  integrityOk: boolean;
}

// Publica a cópia de trabalho por cima do arquivo canônico (about.md, Seção
// 6.3/6.4): fecha a conexão antes de copiar, copia atômica (temp + rename),
// grava backup carimbado, roda integrity_check, reabre a cópia de trabalho.
export async function syncProject(open: OpenProject, user: CurrentUser): Promise<SyncResult> {
  if (open.readOnly) {
    throw new Error('Projeto aberto em somente leitura — não é possível sincronizar.');
  }

  // Se outra pessoa reivindicou o projeto (nosso lock ficou obsoleto, ex.:
  // notebook dormiu), publicar agora apagaria o trabalho dela. As edições
  // continuam na cópia de trabalho e são guardadas na próxima abertura.
  await assertLockOwned(open.dbFile, user);

  const conflict = await hasExternalChange(open);

  const db = await getDbAt(open.dbPath);
  await writeAudit(db, user, { action: 'SYNC', entityType: 'project', entityId: open.id, entityLabel: open.name });

  await closeDbAt(open.dbPath);
  await closeDbAt(open.canonicalPath);

  const dir = await getBancosDir();
  // Sem ponto inicial: alguns matchers de escopo do Tauri (glob) não casam
  // arquivos ocultos com "**" por padrão, o que bloqueava silenciosamente
  // a cópia pro temp.
  const tempPath = await join(dir, `${open.dbFile}.syncing.tmp`);
  await copyFile(open.dbPath, tempPath);
  await rename(tempPath, open.canonicalPath);

  await writeBackup(open);

  const integrityOk = await runIntegrityCheck(open.canonicalPath);

  const machine = await getMachineName();
  await acquireLock(open.dbFile, user, machine);

  await getDbAt(open.dbPath); // reabre a cópia de trabalho pra continuar editando
  const canonicalMtime = await fileMtimeMs(open.canonicalPath);
  await recordCleanWorkingCopy(open.id, open.dbPath, await readChangeCounter(open.canonicalPath));

  const syncedAt = new Date().toISOString();
  return {
    project: { ...open, lastSyncAt: syncedAt, openedCanonicalMtimeMs: canonicalMtime },
    conflict,
    integrityOk,
  };
}

async function hasExternalChange(open: OpenProject): Promise<boolean> {
  if (open.openedCanonicalMtimeMs === null) return false;
  const current = await fileMtimeMs(open.canonicalPath);
  return current !== null && current !== open.openedCanonicalMtimeMs;
}

async function runIntegrityCheck(canonicalPath: string): Promise<boolean> {
  try {
    const db = await getDbAt(canonicalPath);
    const rows = await db.select<{ integrity_check: string }[]>('PRAGMA integrity_check;');
    await closeDbAt(canonicalPath);
    return rows.length === 1 && rows[0].integrity_check === 'ok';
  } catch {
    await closeDbAt(canonicalPath);
    return false;
  }
}

function backupTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function writeBackup(open: OpenProject): Promise<void> {
  const backupsDir = await getBackupsDir();
  if (!(await exists(backupsDir))) {
    await mkdir(backupsDir, { recursive: true });
  }

  const baseName = open.dbFile.replace(/\.db$/, '');
  const backupPath = await join(backupsDir, `${baseName}_${backupTimestamp()}.db`);
  await copyFile(open.canonicalPath, backupPath);

  await rotateBackups(backupsDir, baseName);
}

async function rotateBackups(backupsDir: string, baseName: string): Promise<void> {
  const entries = await readDir(backupsDir);
  const matching = entries
    .filter((e) => e.name?.startsWith(`${baseName}_`) && e.name.endsWith('.db'))
    .map((e) => e.name as string)
    .sort();

  const excess = matching.length - MAX_BACKUPS_PER_PROJECT;
  if (excess <= 0) return;

  for (const name of matching.slice(0, excess)) {
    await remove(await join(backupsDir, name));
  }
}

// Fecha o projeto: registra UNLOCK/CLOSE, sincroniza (se não for somente
// leitura) e libera o lock (about.md, Seção 6.3, passo 4). Os registros vêm
// ANTES do sync pra irem junto pro canônico — gravados depois, ficariam só
// na cópia de trabalho e se perderiam na próxima abertura.
//
// Se o sync falhar, NÃO libera o lock nem fecha a conexão — deixa o erro
// propagar pra quem chamou decidir (tentar de novo, ou abandonar com
// abandonProject; as edições ficam na cópia de trabalho e são recuperadas na
// próxima abertura, ver prepareWorkingCopy).
export async function closeProject(open: OpenProject, user: CurrentUser): Promise<void> {
  if (!open.readOnly) {
    const db = await getDbAt(open.dbPath);
    await writeAudit(db, user, { action: 'UNLOCK', entityType: 'project', entityId: open.id, entityLabel: open.name });
    await writeAudit(db, user, { action: 'CLOSE', entityType: 'project', entityId: open.id, entityLabel: open.name });
    // Impede o heartbeat em andamento de recriar o lock logo depois de
    // liberado. Continua marcado até a próxima abertura deste projeto.
    markClosing(open.dbFile);
    try {
      await syncProject(open, user);
    } catch (err) {
      unmarkClosing(open.dbFile);
      throw err;
    }
    await releaseLockIfOwned(open.dbFile, user);
  }
  await closeDbAt(open.dbPath);
}

// Sai do projeto sem sincronizar (o sync falhou e o usuário escolheu sair
// mesmo assim). O lock não é liberado: fica obsoleto sozinho em alguns
// minutos, e até lá ninguém pega o projeto numa versão sem as edições
// pendentes. Elas continuam na cópia de trabalho local.
export async function abandonProject(open: OpenProject): Promise<void> {
  markClosing(open.dbFile);
  await closeDbAt(open.dbPath);
}

// Edições leves de metadados (nome/descrição), feitas direto no canônico
// com uma conexão de curta duração — abre, grava, fecha imediatamente
// (about.md, Seção 6.4: nunca deixar bancos/ aberto). Não passa pelo
// fluxo completo de cópia de trabalho porque não há edição de domínio
// sustentada aqui, só um metadado pontual.
//
// Recusa se outra pessoa estiver com o projeto aberto: o próximo sync dela
// sobrescreveria o canônico e desfaria a alteração.
export async function renameProject(entry: ProjectIndexEntry, newName: string, description: string | null, user: CurrentUser): Promise<void> {
  const holder = await activeForeignLock(entry.db_file, user);
  if (holder) throw new ProjectLockedError(holder);
  const projectId = entry.id;
  const dbPath = await resolveProjectDbPath(entry);
  const db = await getDbAt(dbPath);
  try {
    const [before] = await db.select<Project[]>('SELECT * FROM projects WHERE id = $1', [projectId]);

    const now = new Date().toISOString();
    await db.execute('UPDATE projects SET name = $1, description = $2, updated_by = $3, updated_at = $4 WHERE id = $5', [
      newName,
      description,
      user.name,
      now,
      projectId,
    ]);
    await writeAudit(db, user, {
      action: 'UPDATE',
      entityType: 'project',
      entityId: projectId,
      entityLabel: newName,
      before,
      after: { ...before, name: newName, description },
    });

    await updateProjectIndexEntry(projectId, { name: newName });
  } finally {
    await closeDbAt(dbPath);
  }
}

export async function deleteProject(entry: ProjectIndexEntry, user: CurrentUser): Promise<void> {
  const holder = await activeForeignLock(entry.db_file, user);
  if (holder) throw new ProjectLockedError(holder);
  const dir = await getBancosDir();
  const dbPath = await join(dir, entry.db_file);
  const db = await getDbAt(dbPath);

  try {
    await writeAudit(db, user, { action: 'DELETE', entityType: 'project', entityId: entry.id, entityLabel: entry.name });
  } finally {
    await closeDbAt(dbPath);
  }

  // Remove só do índice (about.md não define exclusão física do .db no MVP;
  // o arquivo continua em bancos/ como registro/backup implícito).
  await removeProjectIndexEntry(entry.id);
}
