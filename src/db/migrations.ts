import type Database from '@tauri-apps/plugin-sql';
import type { CurrentUser } from '../store/currentUserStore';
import { writeAudit } from './audit';
import { ensureBarrierTypesSchema } from './repositories/barrierTypeRepo';
import { seedDefaultCategories } from './repositories/categoryRepo';

// Cada projeto é um .db próprio e o schema (src-tauri/migrations/001_initial.sql)
// só roda na criação — projetos antigos precisam ser trazidos pra versão atual
// ao abrir. A versão fica gravada no próprio arquivo (PRAGMA user_version), então
// cada migração roda uma única vez por banco, e viaja junto com ele no sync.
//
// Projetos criados antes deste mecanismo estão em user_version 0; por isso cada
// passo também é idempotente (checa se já está aplicado) — a v1 em especial pode
// encontrar bancos que já passaram pela migração antiga de tipos de barreira.
//
// Pra adicionar uma migração: atualizar 001_initial.sql com o schema final
// (projetos novos) E acrescentar um passo aqui (projetos existentes).
const MIGRATIONS: { version: number; run: (db: Database, user: CurrentUser) => Promise<void> }[] = [
  { version: 1, run: ensureBarrierTypesSchema },
  { version: 2, run: addCategories },
  { version: 3, run: addProjectNotice },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function setSchemaVersion(db: Database, version: number): Promise<void> {
  // Inteiro vindo só desta tabela de migrações (nunca de input do usuário);
  // PRAGMA não aceita bind param.
  await db.execute(`PRAGMA user_version = ${Math.trunc(version)}`);
}

export async function migrateProjectDb(db: Database, user: CurrentUser): Promise<void> {
  const [{ user_version: current }] = await db.select<{ user_version: number }[]>('PRAGMA user_version');
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await migration.run(db, user);
    await setSchemaVersion(db, migration.version);
  }
}

async function hasColumn(db: Database, table: string, column: string): Promise<boolean> {
  const rows = await db.select<{ n: number }[]>('SELECT COUNT(*) as n FROM pragma_table_info($1) WHERE name = $2', [table, column]);
  return rows[0].n > 0;
}

async function addCategories(db: Database, user: CurrentUser): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      kind        TEXT NOT NULL CHECK (kind IN ('threat', 'consequence')),
      label       TEXT NOT NULL,
      color       TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_by  TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE (kind, label)
    )`,
  );
  for (const table of ['threats', 'consequences']) {
    if (!(await hasColumn(db, table, 'category_id'))) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL`);
    }
  }
  const [{ n }] = await db.select<{ n: number }[]>('SELECT COUNT(*) as n FROM categories');
  if (n === 0) await seedDefaultCategories(db, user);

  await writeAudit(db, user, { action: 'UPDATE', entityType: 'project', entityLabel: 'migração: categorias de ameaça/consequência' });
}

async function addProjectNotice(db: Database, user: CurrentUser): Promise<void> {
  for (const column of ['notice', 'notice_by', 'notice_at']) {
    if (!(await hasColumn(db, 'projects', column))) {
      await db.execute(`ALTER TABLE projects ADD COLUMN ${column} TEXT`);
    }
  }
  await writeAudit(db, user, { action: 'UPDATE', entityType: 'project', entityLabel: 'migração: aviso do projeto' });
}
