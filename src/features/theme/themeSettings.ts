import { LazyStore } from '@tauri-apps/plugin-store';
import type { ThemePreference } from '../../store/themeStore';

const SETTINGS_FILE = 'settings.json';
const THEME_KEY = 'theme';

export async function loadSavedTheme(): Promise<ThemePreference | undefined> {
  const store = new LazyStore(SETTINGS_FILE);
  return store.get<ThemePreference>(THEME_KEY);
}

export async function saveSavedTheme(theme: ThemePreference): Promise<void> {
  const store = new LazyStore(SETTINGS_FILE);
  await store.set(THEME_KEY, theme);
  await store.save();
}
