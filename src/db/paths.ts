import { appLocalDataDir, executableDir, join } from '@tauri-apps/api/path';

// Raiz de dados: em produção, a pasta do executável (about.md, Seção 6.2 —
// é essa pasta que vai pro SharePoint). Em dev, o .exe fica em
// src-tauri/target/debug/; usar essa pasta poluiria o target de build, então
// usamos uma pasta de dados de dev separada (Seção 6.2, nota "Dev vs
// produção").
async function dataRoot(): Promise<string> {
  if (import.meta.env.DEV) {
    return join(await appLocalDataDir(), 'dev-data');
  }
  return executableDir();
}

export async function getBancosDir(): Promise<string> {
  return join(await dataRoot(), 'bancos');
}

export async function getBackupsDir(): Promise<string> {
  return join(await dataRoot(), 'backups');
}
