import { LazyStore } from '@tauri-apps/plugin-store';

const SETTINGS_FILE = 'settings.json';
const CURRENT_USER_KEY = 'currentUser';

export interface SavedUser {
  name: string;
  email: string;
}

export async function loadSavedUser(): Promise<SavedUser | undefined> {
  const store = new LazyStore(SETTINGS_FILE);
  return store.get<SavedUser>(CURRENT_USER_KEY);
}

export async function saveSavedUser(user: SavedUser): Promise<void> {
  const store = new LazyStore(SETTINGS_FILE);
  await store.set(CURRENT_USER_KEY, user);
  await store.save();
}

// "Sair": esquece o usuário local pra o gate pedir identificação de novo.
export async function clearSavedUser(): Promise<void> {
  const store = new LazyStore(SETTINGS_FILE);
  await store.delete(CURRENT_USER_KEY);
  await store.save();
}
