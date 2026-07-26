import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

function resolveSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

interface ThemeState {
  theme: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const initialResolved = resolveSystemTheme();
applyResolvedTheme(initialResolved);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  resolved: initialResolved,
  setTheme: (theme) => {
    const resolved = theme === 'system' ? resolveSystemTheme() : theme;
    applyResolvedTheme(resolved);
    set({ theme, resolved });
  },
}));

// Se a preferência for "sistema", acompanha mudanças de tema do SO em tempo
// real (ex.: Windows alternando por horário) sem precisar reabrir o app.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  if (useThemeStore.getState().theme !== 'system') return;
  const resolved: ResolvedTheme = event.matches ? 'dark' : 'light';
  applyResolvedTheme(resolved);
  useThemeStore.setState({ resolved });
});
