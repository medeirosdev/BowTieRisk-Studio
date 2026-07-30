import { create } from 'zustand';

// Navegação simples por estado (sem router): a hierarquia do domínio já é
// estritamente linear (about.md, Seção 1) — Projeto → Sessão → Bowtie →
// Editor — então uma pilha de "telas" com os dados de exibição já carregados
// evita reconsultas e mantém a UI simples.
export type NavView =
  | { screen: 'projects' }
  | { screen: 'sessions'; projectId: string; projectName: string }
  | { screen: 'bowties'; sessionId: string; sessionName: string }
  | { screen: 'editor'; sessionId: string; sessionName: string; bowtieId: string; bowtieName: string }
  | { screen: 'audit'; returnTo: Exclude<NavView, { screen: 'audit' }> }
  | { screen: 'barrierTypes'; returnTo: Exclude<NavView, { screen: 'barrierTypes' }> };

interface NavState {
  view: NavView;
  goToProjects: () => void;
  goToSessions: (projectId: string, projectName: string) => void;
  goToBowties: (sessionId: string, sessionName: string) => void;
  goToEditor: (sessionId: string, sessionName: string, bowtieId: string, bowtieName: string) => void;
  goToAudit: () => void;
  goBackFromAudit: () => void;
  goToBarrierTypes: () => void;
  goBackFromBarrierTypes: () => void;
}

export const useNavStore = create<NavState>((set, get) => ({
  view: { screen: 'projects' },
  goToProjects: () => set({ view: { screen: 'projects' } }),
  goToSessions: (projectId, projectName) => set({ view: { screen: 'sessions', projectId, projectName } }),
  goToBowties: (sessionId, sessionName) => set({ view: { screen: 'bowties', sessionId, sessionName } }),
  goToEditor: (sessionId, sessionName, bowtieId, bowtieName) =>
    set({ view: { screen: 'editor', sessionId, sessionName, bowtieId, bowtieName } }),
  goToAudit: () => {
    const current = get().view;
    if (current.screen === 'audit') return;
    set({ view: { screen: 'audit', returnTo: current } });
  },
  goBackFromAudit: () => {
    const current = get().view;
    if (current.screen !== 'audit') return;
    set({ view: current.returnTo });
  },
  goToBarrierTypes: () => {
    const current = get().view;
    if (current.screen === 'barrierTypes') return;
    set({ view: { screen: 'barrierTypes', returnTo: current } });
  },
  goBackFromBarrierTypes: () => {
    const current = get().view;
    if (current.screen !== 'barrierTypes') return;
    set({ view: current.returnTo });
  },
}));
