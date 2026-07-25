import { BowtieMark } from '../components/BowtieMark';
import { BowtiesScreen } from '../features/bowties/BowtiesScreen';
import { EditorScreen } from '../features/editor/EditorScreen';
import { ProjectsScreen } from '../features/projects/ProjectsScreen';
import { SessionsScreen } from '../features/sessions/SessionsScreen';
import { strings } from '../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../store/currentUserStore';
import { useNavStore } from '../store/navStore';
import { useOpenProjectStore } from '../store/openProjectStore';

export function AppShell() {
  const user = useCurrentUserStore((s) => s.user);
  const view = useNavStore((s) => s.view);
  const goToProjects = useNavStore((s) => s.goToProjects);
  const goToSessions = useNavStore((s) => s.goToSessions);
  const goToBowties = useNavStore((s) => s.goToBowties);
  const project = useOpenProjectStore((s) => s.project);
  const setOpenProject = useOpenProjectStore((s) => s.setProject);

  function handleGoToProjects() {
    setOpenProject(null);
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
          <button onClick={handleGoToProjects}>{strings.nav.projects}</button>
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
          {user?.name}
          <br />
          {user?.email}
        </div>
      </header>

      <div className={`shell__content${view.screen === 'editor' ? ' shell__content--full' : ''}`}>
        {view.screen === 'projects' && <ProjectsScreen />}
        {view.screen === 'sessions' && <SessionsScreen />}
        {view.screen === 'bowties' && <BowtiesScreen />}
        {view.screen === 'editor' && <EditorScreen />}
      </div>
    </div>
  );
}
