import { create } from 'zustand';

export interface CurrentUser {
  id: string;
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
