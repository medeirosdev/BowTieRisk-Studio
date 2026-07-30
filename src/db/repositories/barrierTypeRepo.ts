import type Database from '@tauri-apps/plugin-sql';
import type { CurrentUser } from '../../store/currentUserStore';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { newId } from '../ids';

export interface BarrierTypeRow {
  id: string;
  label: string;
  order_index: number;
}

// Ids iguais aos do antigo enum fixo (about.md, Seção 5.1) — projetos criados
// antes desta feature já têm barreiras com barrier_type = um desses ids
// literais, então reaproveitá-los aqui evita precisar remapear dado antigo.
const DEFAULT_BARRIER_TYPES: readonly [string, string][] = [
  ['hardware_passivo', 'Hardware Passivo'],
  ['hardware_ativo', 'Hardware Ativo'],
  ['hardware_ativo_humano', 'Hardware Ativo + Humano'],
  ['humano_comportamental', 'Humano / Comportamental'],
  ['hardware_continuo', 'Hardware Contínuo'],
];

// Projetos criados antes desta feature não têm a tabela barrier_types nem o
// CHECK antigo removido de preventive/mitigative_barriers — não há sistema de
// migration incremental (about.md, Seção 6.6: schema só roda uma vez, na
// criação), então este passo idempotente cobre quem abre um projeto antigo.
// Chamado sempre em openProject; é barato (poucos SELECTs) quando já migrado.
export async function ensureBarrierTypesSchema(db: Database, user: CurrentUser): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS barrier_types (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL UNIQUE,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
  );

  const countRows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM barrier_types');
  if (countRows[0].count === 0) {
    const now = new Date().toISOString();
    for (let i = 0; i < DEFAULT_BARRIER_TYPES.length; i++) {
      const [id, label] = DEFAULT_BARRIER_TYPES[i];
      await db.execute(
        'INSERT INTO barrier_types (id, label, order_index, created_by, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, label, i, user.name, now],
      );
    }
  }

  await dropBarrierTypeCheck(db, 'preventive_barriers', 'threat_id', 'threats');
  await dropBarrierTypeCheck(db, 'mitigative_barriers', 'consequence_id', 'consequences');
}

async function dropBarrierTypeCheck(db: Database, table: string, parentColumn: string, parentTable: string): Promise<void> {
  const rows = await db.select<{ sql: string }[]>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = $1", [table]);
  const currentSql = rows[0]?.sql ?? '';
  if (!currentSql.includes('CHECK (barrier_type IN')) return; // já migrado

  // SQLite não suporta ALTER TABLE ... DROP CONSTRAINT: recria a tabela sem o
  // CHECK, copia os dados, e troca os antigos ids de tipo (slugs) pelos
  // rótulos correspondentes — mesma convenção que barrier_type passa a usar
  // dali em diante (texto livre, não uma referência).
  //
  // Tudo num ÚNICO db.execute() (sem bind params, mesmo padrão de schemaSql
  // em projectRepo.ts) — o tauri-plugin-sql usa um pool de conexões por
  // baixo (sqlx::Pool), então BEGIN/COMMIT enviados em chamadas separadas
  // podem cair em conexões diferentes do pool e nunca formar uma transação
  // de verdade. Um único execute() garante que tudo roda na mesma conexão.
  const caseClauses = DEFAULT_BARRIER_TYPES.map(([id, label]) => `WHEN '${id}' THEN '${label}'`).join(' ');
  await db.execute(`
    PRAGMA foreign_keys = OFF;
    BEGIN TRANSACTION;
    ALTER TABLE ${table} RENAME TO ${table}_old;
    CREATE TABLE ${table} (
      id            TEXT PRIMARY KEY,
      ${parentColumn}     TEXT NOT NULL REFERENCES ${parentTable}(id) ON DELETE CASCADE,
      label         TEXT NOT NULL,
      description   TEXT,
      barrier_type  TEXT,
      effectiveness INTEGER CHECK (effectiveness IS NULL OR effectiveness BETWEEN 1 AND 5),
      order_index   INTEGER NOT NULL DEFAULT 0,
      created_by    TEXT NOT NULL, created_at TEXT NOT NULL,
      updated_by    TEXT, updated_at TEXT
    );
    INSERT INTO ${table} SELECT * FROM ${table}_old;
    DROP TABLE ${table}_old;
    UPDATE ${table} SET barrier_type = CASE barrier_type ${caseClauses} ELSE barrier_type END WHERE barrier_type IS NOT NULL;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

export async function listBarrierTypes(dbPath: string): Promise<BarrierTypeRow[]> {
  const db = await getDbAt(dbPath);
  return db.select<BarrierTypeRow[]>('SELECT id, label, order_index FROM barrier_types ORDER BY order_index');
}

export async function createBarrierType(dbPath: string, label: string, user: CurrentUser): Promise<BarrierTypeRow> {
  const db = await getDbAt(dbPath);
  const id = newId();
  const now = new Date().toISOString();
  const maxRows = await db.select<{ maxOrder: number | null }[]>('SELECT MAX(order_index) as maxOrder FROM barrier_types');
  const orderIndex = (maxRows[0]?.maxOrder ?? -1) + 1;

  await db.execute(
    'INSERT INTO barrier_types (id, label, order_index, created_by, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, label, orderIndex, user.name, now],
  );
  await writeAudit(db, user, { action: 'CREATE', entityType: 'barrier_type', entityId: id, entityLabel: label });

  return { id, label, order_index: orderIndex };
}

export async function deleteBarrierType(dbPath: string, type: BarrierTypeRow, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('DELETE FROM barrier_types WHERE id = $1', [type.id]);
  await writeAudit(db, user, { action: 'DELETE', entityType: 'barrier_type', entityId: type.id, entityLabel: type.label });
}
