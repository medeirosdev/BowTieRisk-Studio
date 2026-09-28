import { join } from '@tauri-apps/api/path';
import { copyFile, exists, mkdir, open, readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { getUnsyncedDir, getWorkingStatePath } from './paths';

// Estado da cópia de trabalho local, gravado sempre que ela fica "limpa"
// (igual ao canônico): logo depois de abrir o projeto e depois de cada sync.
// Se o contador de alterações atual da cópia diferir de cleanWorkingCounter,
// ela tem edições que nunca chegaram em bancos/ — o app fechou sem
// sincronizar (crash, sync falhou e o usuário saiu mesmo assim, lock
// perdido). Sem isso, a próxima abertura sobrescreveria a cópia a partir do
// canônico e as edições sumiriam em silêncio.
interface WorkingCopyState {
  baseCanonicalCounter: number | null; // contador do canônico de onde a cópia veio
  cleanWorkingCounter: number | null;
}

// "File change counter" do cabeçalho do SQLite (bytes 24–27, big-endian):
// incrementado a cada transação de escrita commitada no modo de journal
// DELETE (o único que o app usa). Melhor que o mtime pra saber se o arquivo
// mudou: não depende de resolução de relógio nem de o OneDrive/SharePoint
// preservar datas, e uma cópia byte a byte (o sync) carrega o mesmo valor.
export async function readChangeCounter(path: string): Promise<number | null> {
  try {
    const file = await open(path, { read: true });
    try {
      const header = new Uint8Array(28);
      const read = await file.read(header);
      if (read === null || read < 28) return null;
      return new DataView(header.buffer).getUint32(24);
    } finally {
      await file.close();
    }
  } catch {
    return null;
  }
}

export async function fileMtimeMs(path: string): Promise<number | null> {
  try {
    const info = await stat(path);
    return info.mtime ? info.mtime.getTime() : null;
  } catch {
    return null;
  }
}

async function readState(projectId: string): Promise<WorkingCopyState | null> {
  const path = await getWorkingStatePath(projectId);
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readTextFile(path)) as WorkingCopyState;
  } catch {
    return null;
  }
}

export async function recordCleanWorkingCopy(projectId: string, workingPath: string, baseCanonicalCounter: number | null): Promise<void> {
  const state: WorkingCopyState = { baseCanonicalCounter, cleanWorkingCounter: await readChangeCounter(workingPath) };
  await writeTextFile(await getWorkingStatePath(projectId), JSON.stringify(state));
}

export type WorkingCopyStatus = { dirty: false } | { dirty: true; baseCanonicalCounter: number | null };

// Sem arquivo de estado (cópias criadas por versões anteriores do app) conta
// como limpa — mesmo comportamento de antes desta verificação existir.
export async function workingCopyStatus(projectId: string, workingPath: string): Promise<WorkingCopyStatus> {
  if (!(await exists(workingPath))) return { dirty: false };
  const state = await readState(projectId);
  if (!state || state.cleanWorkingCounter === null || state.cleanWorkingCounter === undefined) return { dirty: false };
  const current = await readChangeCounter(workingPath);
  if (current === null || current === state.cleanWorkingCounter) return { dirty: false };
  return { dirty: true, baseCanonicalCounter: state.baseCanonicalCounter };
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// Guarda uma cópia da cópia de trabalho em backups/nao-sincronizados/ e
// devolve o caminho. A conexão com ela precisa estar fechada.
export async function stashWorkingCopy(workingPath: string, dbFile: string): Promise<string> {
  const dir = await getUnsyncedDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  const target = await join(dir, `${dbFile.replace(/\.db$/, '')}_${stamp()}.db`);
  await copyFile(workingPath, target);
  return target;
}
