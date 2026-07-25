import { UserGate } from './features/user/UserGate';
import { strings } from './i18n/strings.pt-BR';
import { useCurrentUserStore } from './store/currentUserStore';
import './App.css';

function Home() {
  const user = useCurrentUserStore((state) => state.user);

  return (
    <main className="home">
      <h1>{strings.app.title}</h1>
      <p>
        {strings.app.signedInAs}: {user?.name} ({user?.email})
      </p>
      <p>{strings.app.homePlaceholder}</p>
    </main>
  );
}

function App() {
  return (
    <UserGate>
      <Home />
    </UserGate>
  );
}

export default App;
