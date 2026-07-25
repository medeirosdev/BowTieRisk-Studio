import { create } from 'zustand';

// Identidade local (nome + email) — atribuição, não autenticação (about.md,
// Seção 9). O email é a chave natural do usuário; não há um id global: cada
// projeto registra sua própria linha em `users` ao ser criado/aberto
// (projectRepo.touchProjectUser).
export interface CurrentUser {
  name: string;
  email: string;
}

interface CurrentUserState {
  user: CurrentUser | null;
  setUser: (user: CurrentUser) => void;
  clearUser: () => void;
}

export const useCurrentUserStore = create<CurrentUserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
