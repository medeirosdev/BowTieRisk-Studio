import { create } from 'zustand';

// Navegação simples por estado (sem router): a hierarquia do domínio já é
// estritamente linear (about.md, Seção 1) — Projeto → Sessão → Bowtie →
// Editor — então uma pilha de "telas" com os dados de exibição já carregados
// evita reconsultas e mantém a UI simples.
export type NavView =
  | { screen: 'projects' }
  | { screen: 'sessions'; projectId: string; projectName: string }
  | { screen: 'bowties'; sessionId: string; sessionName: string }
  | { screen: 'editor'; sessionId: string; sessionName: string; bowtieId: string; bowtieName: string };

interface NavState {
  view: NavView;
  goToProjects: () => void;
  goToSessions: (projectId: string, projectName: string) => void;
  goToBowties: (sessionId: string, sessionName: string) => void;
  goToEditor: (sessionId: string, sessionName: string, bowtieId: string, bowtieName: string) => void;
}

export const useNavStore = create<NavState>((set) => ({
  view: { screen: 'projects' },
  goToProjects: () => set({ view: { screen: 'projects' } }),
  goToSessions: (projectId, projectName) => set({ view: { screen: 'sessions', projectId, projectName } }),
  goToBowties: (sessionId, sessionName) => set({ view: { screen: 'bowties', sessionId, sessionName } }),
  goToEditor: (sessionId, sessionName, bowtieId, bowtieName) =>
    set({ view: { screen: 'editor', sessionId, sessionName, bowtieId, bowtieName } }),
}));
