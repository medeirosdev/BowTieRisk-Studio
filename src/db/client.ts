import Database from '@tauri-apps/plugin-sql';

// Cache de conexões abertas, por caminho absoluto do arquivo .db. Cada
// projeto é um arquivo próprio (about.md, Seção 5); o app pode ter mais de
// uma conexão viva ao mesmo tempo (ex.: navegando entre projetos).
const connections = new Map<string, Promise<Database>>();

async function withPragmas(db: Database): Promise<Database> {
  // PRAGMAs obrigatórios (about.md, Seção 5.4): nunca WAL num arquivo que
  // será sincronizado pelo SharePoint, chaves estrangeiras ativas, timeout
  // curto de lock para não travar a UI.
  await db.execute('PRAGMA journal_mode = DELETE;');
  await db.execute('PRAGMA foreign_keys = ON;');
  await db.execute('PRAGMA busy_timeout = 5000;');
  return db;
}

// Abre (ou reaproveita) a conexão para o arquivo .db no caminho absoluto
// dado. Fase 1: abre o arquivo canônico em bancos/ diretamente ("ainda sem
// sync", about.md Seção 12). A partir da Fase 2, isso passa a operar sobre
// uma cópia de trabalho local com lock+heartbeat (Seção 6.3).
export function getDbAt(absolutePath: string): Promise<Database> {
  let conn = connections.get(absolutePath);
  if (!conn) {
    conn = Database.load(`sqlite:${absolutePath}`).then(withPragmas);
    // Se a conexão falhar, remove do cache: sem isso, uma falha transitória
    // (ex.: arquivo momentaneamente bloqueado) "envenena" o caminho para o
    // resto da sessão, já que toda chamada futura reaproveitaria a mesma
    // promise rejeitada.
    conn.catch(() => connections.delete(absolutePath));
    connections.set(absolutePath, conn);
  }
  return conn;
}

export async function closeDbAt(absolutePath: string): Promise<void> {
  const conn = connections.get(absolutePath);
  if (!conn) return;
  connections.delete(absolutePath);
  const db = await conn;
  await db.close();
}
