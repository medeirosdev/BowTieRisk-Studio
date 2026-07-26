import { FormEvent, ReactNode, useEffect, useState } from 'react';
import cnpemLogo from '../../assets/branding/cnpem-logo.svg';
import lnlsLogo from '../../assets/branding/lnls-logo.png';
import { BowtieMark } from '../../components/BowtieMark';
import { strings } from '../../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../../store/currentUserStore';
import { loadSavedUser, saveSavedUser } from './userSettings';
import './UserGate.css';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

// Gate de identificação (about.md, Seção 8.1): antes de criar/editar
// qualquer coisa, exige nome + email. Sem senha — é atribuição, não
// autenticação. Fica só local (tauri-plugin-store); cada projeto registra
// sua própria linha em `users` quando é criado/aberto (projectRepo).
export function UserGate({ children }: { children: ReactNode }) {
  const user = useCurrentUserStore((state) => state.user);
  const setUser = useCurrentUserStore((state) => state.setUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = await loadSavedUser();
      if (saved && !cancelled) {
        setUser(saved);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [setUser]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError(strings.userGate.nameRequired);
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(strings.userGate.emailRequired);
      return;
    }

    setError(null);
    try {
      await saveSavedUser({ name: trimmedName, email: trimmedEmail });
      setUser({ name: trimmedName, email: trimmedEmail });
    } catch (err) {
      console.error(err);
      setError(strings.userGate.genericError);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="user-gate">
        <div className="user-gate__wallpaper" />

        <form className="user-gate__form" onSubmit={handleSubmit}>
          <div className="user-gate__brand">
            <BowtieMark />
            <h1>{strings.userGate.title}</h1>
          </div>
          <p className="user-gate__subtitle">{strings.userGate.subtitle}</p>

          <label className="user-gate__field">
            {strings.userGate.nameLabel}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={strings.userGate.namePlaceholder}
              autoFocus
            />
          </label>

          <label className="user-gate__field">
            {strings.userGate.emailLabel}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={strings.userGate.emailPlaceholder}
            />
          </label>

          {error && <p className="user-gate__error">{error}</p>}

          <p className="user-gate__notice">{strings.userGate.auditNotice}</p>

          <button type="submit">{strings.userGate.submit}</button>
        </form>

        <div className="user-gate__brands">
          <img src={cnpemLogo} alt="CNPEM" className="user-gate__brand-logo user-gate__brand-logo--cnpem" />
          <span className="user-gate__brands-divider" aria-hidden="true" />
          <img src={lnlsLogo} alt="LNLS" className="user-gate__brand-logo user-gate__brand-logo--lnls" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
