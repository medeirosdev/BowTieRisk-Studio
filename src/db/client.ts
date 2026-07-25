import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

// Abre (ou reaproveita) a conexão com a cópia de trabalho do banco atual.
// Fase 0: usa um identificador fixo ("working.db") só para validar a
// fundação ponta a ponta. A partir da Fase 1, a abertura de um projeto passa
// a copiar `bancos/<projeto>.db` para a cópia de trabalho local antes de
// chamar `Database.load` (about.md, Seção 6.3).
export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const db = await Database.load('sqlite:working.db');

  // PRAGMAs obrigatórios (about.md, Seção 5.4): nunca WAL num arquivo que
  // será sincronizado pelo SharePoint, chaves estrangeiras ativas, timeout
  // curto de lock para não travar a UI.
  await db.execute('PRAGMA journal_mode = DELETE;');
  await db.execute('PRAGMA foreign_keys = ON;');
  await db.execute('PRAGMA busy_timeout = 5000;');

  dbInstance = db;
  return dbInstance;
}
