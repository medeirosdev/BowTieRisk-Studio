import { BowtieMark } from './components/BowtieMark';
import { UserGate } from './features/user/UserGate';
import { strings } from './i18n/strings.pt-BR';
import { useCurrentUserStore } from './store/currentUserStore';
import './App.css';

function Home() {
  const user = useCurrentUserStore((state) => state.user);

  return (
    <main className="home">
      <div className="home__brand">
        <BowtieMark size={32} />
        <h1>{strings.app.title}</h1>
      </div>

      <dl className="home__user-card">
        <dt>{strings.app.signedInAs}</dt>
        <dd>{user?.name}</dd>
        <dd>{user?.email}</dd>
      </dl>

      <p className="home__placeholder">{strings.app.homePlaceholder}</p>
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
