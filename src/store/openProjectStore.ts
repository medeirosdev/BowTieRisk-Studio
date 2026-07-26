import { create } from 'zustand';
import type { OpenProject } from '../db/repositories/projectRepo';

interface OpenProjectState {
  project: OpenProject | null;
  setProject: (project: OpenProject | null) => void;
}

// Projeto atualmente aberto: cópia de trabalho, estado do lock (readOnly +
// quem segura, se for o caso) e último sync (about.md, Seção 6.3).
export const useOpenProjectStore = create<OpenProjectState>((set) => ({
  project: null,
  setProject: (project) => set({ project }),
}));
