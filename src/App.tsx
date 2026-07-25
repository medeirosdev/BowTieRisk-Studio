import { AppShell } from './app/AppShell';
import { UserGate } from './features/user/UserGate';
import './App.css';

function App() {
  return (
    <UserGate>
      <AppShell />
    </UserGate>
  );
}

export default App;
