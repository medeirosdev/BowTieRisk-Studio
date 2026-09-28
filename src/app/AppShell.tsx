import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { BowtieMark } from '../components/BowtieMark';
import type { LockInfo } from '../db/lockRepo';
import { abandonProject, closeProject } from '../db/repositories/projectRepo';
import { AuditScreen } from '../features/audit/AuditScreen';
import { BowtiesScreen } from '../features/bowties/BowtiesScreen';
import { EditorScreen } from '../features/editor/EditorScreen';
import { ProjectNoticeBanner } from '../features/projectSettings/ProjectNoticeBanner';
import { ProjectSettingsScreen } from '../features/projectSettings/ProjectSettingsScreen';
import { ProjectsScreen } from '../features/projects/ProjectsScreen';
import { SessionsScreen } from '../features/sessions/SessionsScreen';
import { StatusBar } from '../features/sync/StatusBar';
import { useHeartbeat } from '../features/sync/useHeartbeat';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { useDialog } from '../features/ui/DialogProvider';
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
  const goToAudit = useNavStore((s) => s.goToAudit);
  const goToSettings = useNavStore((s) => s.goToSettings);
  const project = useOpenProjectStore((s) => s.project);
  const setOpenProject = useOpenProjectStore((s) => s.setProject);
  const patchProject = useOpenProjectStore((s) => s.patchProject);
  const { alert, confirm } = useDialog();

  useHeartbeat(project, user, (holder: LockInfo) => {
    if (!project) return;
    patchProject(project.id, { readOnly: true, lockOwner: holder });
    void alert(strings.sync.lockLost(holder.user_name));
  });

  // Fecha (sincroniza + libera o lock) o projeto atual, se houver. Se o sync
  // falhar, pergunta: ficar e tentar de novo (retorna false — quem chamou não
  // navega) ou sair mesmo assim (as edições ficam na cópia de trabalho e são
  // recuperadas na próxima abertura, ver prepareWorkingCopy em projectRepo).
  async function closeCurrentProject(): Promise<boolean> {
    const current = useOpenProjectStore.getState().project;
    if (!current || !user) return true;
    try {
      await closeProject(current, user);
      setOpenProject(null);
      return true;
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      const leave = await confirm(strings.sync.closeSyncErrorLeave(detail), {
        confirmLabel: strings.sync.leaveAnyway,
        cancelLabel: strings.sync.stay,
        danger: true,
      });
      if (!leave) return false;
      await abandonProject(current).catch((e) => console.error(e));
      setOpenProject(null);
      return true;
    }
  }

  // Fechar a janela passa pelo mesmo caminho de "sair do projeto" — sem
  // isso, o X da janela descartava o que não tinha sido sincronizado e
  // deixava o lock preso por 3 minutos.
  const closeRef = useRef(closeCurrentProject);
  closeRef.current = closeCurrentProject;
  useEffect(() => {
    const win = getCurrentWindow();
    let closing = false;
    const unlisten = win.onCloseRequested(async (event) => {
      event.preventDefault();
      if (closing) return;
      closing = true;
      try {
        if (await closeRef.current()) {
          await win.destroy();
        }
      } finally {
        closing = false;
      }
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

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
          <div className="shell__brand-text">
            <h1>{strings.app.title}</h1>
            <span className="shell__brand-sub">{strings.app.titleFull}</span>
          </div>
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
          {view.screen === 'audit' && (
            <>
              <span>/</span>
              <span>{strings.audit.title}</span>
            </>
          )}
          {view.screen === 'settings' && (
            <>
              <span>/</span>
              <span>{strings.projectSettings.title}</span>
            </>
          )}
        </div>

        <div className="shell__user">
          <ThemeToggle />
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

      {view.screen !== 'projects' && project && user && (
        <StatusBar key={project.id} project={project} user={user} onOpenAudit={goToAudit} onOpenSettings={goToSettings} />
      )}

      {view.screen !== 'projects' && project?.notice && <ProjectNoticeBanner notice={project.notice} />}

      <div className={`shell__content${view.screen === 'editor' ? ' shell__content--full' : ''}`}>
        {view.screen === 'projects' && <ProjectsScreen />}
        {view.screen === 'sessions' && <SessionsScreen />}
        {view.screen === 'bowties' && <BowtiesScreen />}
        {view.screen === 'editor' && <EditorScreen />}
        {view.screen === 'audit' && <AuditScreen />}
        {view.screen === 'settings' && <ProjectSettingsScreen />}
      </div>
    </div>
  );
}
