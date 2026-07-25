import { join } from '@tauri-apps/api/path';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import type Database from '@tauri-apps/plugin-sql';
// Fonte única do schema: o mesmo SQL que roda como migration no Rust
// (src-tauri/src/lib.rs) é aplicado aqui ao criar um banco por projeto,
// já que cada projeto tem um nome de arquivo dinâmico (about.md, Seção 6.6)
// e o mecanismo de `add_migrations` do plugin funciona por identificador fixo.
import schemaSql from '../../../src-tauri/migrations/001_initial.sql?raw';
import type { CurrentUser } from '../../store/currentUserStore';
import type { Project } from '../../types/domain';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { appendProjectIndexEntry, ProjectIndexEntry, readProjectIndex, removeProjectIndexEntry, updateProjectIndexEntry } from '../indexFile';
import { newId } from '../ids';
import { getBancosDir } from '../paths';
import { slugify } from '../slug';

export interface OpenProject {
  id: string;
  name: string;
  dbPath: string;
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

export async function createProject(name: string, description: string | null, user: CurrentUser): Promise<OpenProject> {
  const dir = await getBancosDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }

  const id = newId();
  const baseSlug = slugify(name) || `projeto-${id.slice(-6).toLowerCase()}`;
  const dbFile = await uniqueDbFileName(dir, baseSlug);
  const dbPath = await join(dir, dbFile);

  const db = await getDbAt(dbPath);
  await db.execute(schemaSql);

  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO projects (id, name, description, created_by, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, name, description, user.name, now],
  );
  await touchProjectUser(db, user);
  await writeAudit(db, user, { action: 'CREATE', entityType: 'project', entityId: id, entityLabel: name });

  await appendProjectIndexEntry({ id, name, db_file: dbFile, created_by: user.name, created_at: now });

  return { id, name, dbPath };
}

export async function openProject(entry: ProjectIndexEntry, user: CurrentUser): Promise<OpenProject> {
  const dir = await getBancosDir();
  const dbPath = await join(dir, entry.db_file);
  const db = await getDbAt(dbPath);

  await touchProjectUser(db, user);
  await writeAudit(db, user, { action: 'OPEN', entityType: 'project', entityId: entry.id, entityLabel: entry.name });

  return { id: entry.id, name: entry.name, dbPath };
}

export async function renameProject(dbPath: string, projectId: string, newName: string, description: string | null, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
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
}

export async function deleteProject(entry: ProjectIndexEntry, user: CurrentUser): Promise<void> {
  const dir = await getBancosDir();
  const dbPath = await join(dir, entry.db_file);
  const db = await getDbAt(dbPath);

  await writeAudit(db, user, { action: 'DELETE', entityType: 'project', entityId: entry.id, entityLabel: entry.name });

  // Remove só do índice (about.md não define exclusão física do .db no MVP;
  // o arquivo continua em bancos/ como registro/backup implícito).
  await removeProjectIndexEntry(entry.id);
}
