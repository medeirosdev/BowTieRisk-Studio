import { BowtieMark } from '../components/BowtieMark';
import { closeProject } from '../db/repositories/projectRepo';
import { BowtiesScreen } from '../features/bowties/BowtiesScreen';
import { EditorScreen } from '../features/editor/EditorScreen';
import { ProjectsScreen } from '../features/projects/ProjectsScreen';
import { SessionsScreen } from '../features/sessions/SessionsScreen';
import { StatusBar } from '../features/sync/StatusBar';
import { useHeartbeat } from '../features/sync/useHeartbeat';
import { clearSavedUser } from '../features/user/userSettings';
import { strings } from '../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../store/currentUserStore';
import { useNavStore } from '../store/navStore';
import { useOpenProjectStore } from '../store/openProjectStore';

export function AppShell() {
  const user = useCurrentUserStore((s) => s.user);
  const clearUser = useCurrentUserStore((s) => s.clearUser);
  const view = useNavStore((s) => s.view);
  const goToProjects = useNavStore((s) => s.goToProjects);
  const goToSessions = useNavStore((s) => s.goToSessions);
  const goToBowties = useNavStore((s) => s.goToBowties);
  const project = useOpenProjectStore((s) => s.project);
  const setOpenProject = useOpenProjectStore((s) => s.setProject);

  useHeartbeat(project);

  // Fecha (sincroniza + libera o lock) o projeto atual, se houver. Retorna
  // false se o sync falhar — quem chamou decide o que fazer (não navegar,
  // avisar o usuário) em vez de perder silenciosamente edições não
  // publicadas (о lock só é liberado se o sync deu certo, ver closeProject).
  async function closeCurrentProject(): Promise<boolean> {
    if (!project || !user) return true;
    try {
      await closeProject(project, user);
      setOpenProject(null);
      return true;
    } catch (err) {
      console.error(err);
      window.alert(strings.sync.closeSyncError);
      return false;
    }
  }

  async function handleGoToProjects() {
    if (await closeCurrentProject()) {
      goToProjects();
    }
  }

  async function handleLogout() {
    if (!(await closeCurrentProject())) return;
    try {
      await clearSavedUser();
    } catch (err) {
      console.error(err);
    }
    clearUser();
    goToProjects();
  }

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <BowtieMark size={22} />
          <h1>{strings.app.title}</h1>
        </div>

        <div className="shell__breadcrumb">
          <button onClick={() => void handleGoToProjects()}>{strings.nav.projects}</button>
          {view.screen !== 'projects' && project && (
            <>
              <span>/</span>
              <button onClick={() => goToSessions(project.id, project.name)}>{project.name}</button>
            </>
          )}
          {view.screen === 'bowties' && (
            <>
              <span>/</span>
              <span>{view.sessionName}</span>
            </>
          )}
          {view.screen === 'editor' && (
            <>
              <span>/</span>
              <button onClick={() => goToBowties(view.sessionId, view.sessionName)}>{view.sessionName}</button>
              <span>/</span>
              <span>{view.bowtieName}</span>
            </>
          )}
        </div>

        <div className="shell__user">
          <div className="shell__user-info">
            {user?.name}
            <br />
            {user?.email}
          </div>
          <button type="button" className="icon-btn" onClick={() => void handleLogout()}>
            {strings.common.logout}
          </button>
        </div>
      </header>

      {view.screen !== 'projects' && project && user && <StatusBar project={project} user={user} onProjectUpdate={setOpenProject} />}

      <div className={`shell__content${view.screen === 'editor' ? ' shell__content--full' : ''}`}>
        {view.screen === 'projects' && <ProjectsScreen />}
        {view.screen === 'sessions' && <SessionsScreen />}
        {view.screen === 'bowties' && <BowtiesScreen />}
        {view.screen === 'editor' && <EditorScreen />}
      </div>
    </div>
  );
}
