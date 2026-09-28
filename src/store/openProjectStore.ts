import { create } from 'zustand';
import type { OpenProject } from '../db/repositories/projectRepo';

interface OpenProjectState {
  project: OpenProject | null;
  setProject: (project: OpenProject | null) => void;
  // Mescla campos no projeto ATUAL da store — para quem terminou uma
  // operação assíncrona e não pode sobrescrever o projeto inteiro com o
  // snapshot que tinha quando começou (ex.: sync concluído depois de o aviso
  // ter sido editado). Ignorado se, nesse meio-tempo, outro projeto foi
  // aberto ou o atual fechado.
  patchProject: (projectId: string, patch: Partial<OpenProject>) => void;
}

// Projeto atualmente aberto: cópia de trabalho, estado do lock (readOnly +
// quem segura, se for o caso) e último sync (about.md, Seção 6.3).
export const useOpenProjectStore = create<OpenProjectState>((set) => ({
  project: null,
  setProject: (project) => set({ project }),
  patchProject: (projectId, patch) =>
    set((state) => (state.project?.id === projectId ? { project: { ...state.project, ...patch } } : state)),
}));
