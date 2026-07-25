import { join } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { getBancosDir } from './paths';

// Registro leve de projetos (about.md, Seção 6.2) — permite listar projetos
// sem abrir cada banco .db individualmente.
export interface ProjectIndexEntry {
  id: string;
  name: string;
  db_file: string;
  created_by: string;
  created_at: string;
}

interface ProjectIndexFile {
  projects: ProjectIndexEntry[];
}

async function ensureBancosDir(): Promise<string> {
  const dir = await getBancosDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

async function indexPath(): Promise<string> {
  return join(await ensureBancosDir(), 'index.json');
}

export async function readProjectIndex(): Promise<ProjectIndexEntry[]> {
  const path = await indexPath();
  if (!(await exists(path))) return [];
  const raw = await readTextFile(path);
  const parsed = JSON.parse(raw) as ProjectIndexFile;
  return parsed.projects ?? [];
}

async function writeProjectIndex(projects: ProjectIndexEntry[]): Promise<void> {
  const path = await indexPath();
  await writeTextFile(path, JSON.stringify({ projects }, null, 2));
}

export async function appendProjectIndexEntry(entry: ProjectIndexEntry): Promise<void> {
  const projects = await readProjectIndex();
  projects.push(entry);
  await writeProjectIndex(projects);
}

export async function updateProjectIndexEntry(id: string, patch: Partial<Pick<ProjectIndexEntry, 'name'>>): Promise<void> {
  const projects = await readProjectIndex();
  const next = projects.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await writeProjectIndex(next);
}

export async function removeProjectIndexEntry(id: string): Promise<void> {
  const projects = await readProjectIndex();
  await writeProjectIndex(projects.filter((p) => p.id !== id));
}
