import { useEffect } from 'react';
import { AppShell } from './app/AppShell';
import { DialogProvider } from './features/ui/DialogProvider';
import { loadSavedTheme } from './features/theme/themeSettings';
import { UserGate } from './features/user/UserGate';
import { useThemeStore } from './store/themeStore';
import './App.css';

function App() {
  const setTheme = useThemeStore((s) => s.setTheme);

  // Carrega a preferência de tema salva antes do login também, senão a tela
  // de identificação pisca no tema do sistema até o AppShell montar.
  useEffect(() => {
    (async () => {
      const saved = await loadSavedTheme();
      if (saved) setTheme(saved);
    })().catch((err) => console.error(err));
  }, [setTheme]);

  return (
    <DialogProvider>
      <UserGate>
        <AppShell />
      </UserGate>
    </DialogProvider>
  );
}

export default App;
