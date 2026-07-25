import { create } from 'zustand';
import type { OpenProject } from '../db/repositories/projectRepo';

interface OpenProjectState {
  project: OpenProject | null;
  setProject: (project: OpenProject | null) => void;
}

// Projeto atualmente aberto (id, nome e caminho do .db) — Fase 1 opera
// direto sobre o arquivo canônico em bancos/ (about.md, Seção 12: "ainda
// sem sync"); a cópia de trabalho local entra na Fase 2.
export const useOpenProjectStore = create<OpenProjectState>((set) => ({
  project: null,
  setProject: (project) => set({ project }),
}));
