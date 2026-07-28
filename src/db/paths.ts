import { invoke } from '@tauri-apps/api/core';
import { appLocalDataDir, join } from '@tauri-apps/api/path';

// Raiz de dados: em produção, a pasta do executável (about.md, Seção 6.2 —
// é essa pasta que vai pro SharePoint). Em dev, o .exe fica em
// src-tauri/target/debug/; usar essa pasta poluiria o target de build, então
// usamos uma pasta de dados de dev separada (Seção 6.2, nota "Dev vs
// produção").
//
// NÃO usar executableDir() da API de path do Tauri aqui: apesar do nome, ela
// resolve pro diretório de binários do usuário no padrão XDG (Linux), e é
// "Not supported" no Windows/macOS — lá sempre lança Error::UnknownPath. O
// que precisamos é o diretório do .exe em execução (std::env::current_exe()),
// que só existe como comando Rust próprio (get_executable_dir, src-tauri/src/lib.rs).
async function dataRoot(): Promise<string> {
  if (import.meta.env.DEV) {
    return join(await appLocalDataDir(), 'dev-data');
  }
  return invoke<string>('get_executable_dir');
}

export async function getBancosDir(): Promise<string> {
  return join(await dataRoot(), 'bancos');
}

export async function getBackupsDir(): Promise<string> {
  return join(await dataRoot(), 'backups');
}

// Cópia de trabalho (about.md, Seção 6.2/6.3): fica FORA de bancos/, em
// AppData local não sincronizado — é nela que o SQLite realmente abre/edita.
// Nomeada pelo id do projeto (estável mesmo se o projeto for renomeado).
export async function getWorkingDbPath(projectId: string): Promise<string> {
  const dir = await join(await appLocalDataDir(), 'working');
  return join(dir, `${projectId}.db`);
}

export async function getWorkingDir(): Promise<string> {
  return join(await appLocalDataDir(), 'working');
}

// Caminho do arquivo de lock do projeto: bancos/<slug>.db.lock.json.
export async function getLockPath(dbFile: string): Promise<string> {
  return join(await getBancosDir(), `${dbFile}.lock.json`);
}
