import { useState } from 'react';
import { LockLostError } from '../../db/lockRepo';
import { syncProject } from '../../db/repositories/projectRepo';
import type { OpenProject } from '../../db/repositories/projectRepo';
import { strings } from '../../i18n/strings.pt-BR';
import type { CurrentUser } from '../../store/currentUserStore';
import { useOpenProjectStore } from '../../store/openProjectStore';

interface StatusBarProps {
  project: OpenProject;
  user: CurrentUser;
  onOpenAudit: () => void;
  onOpenSettings: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function initialMessage(project: OpenProject): string | null {
  const parts: string[] = [];
  if (project.recovery?.kind === 'resumed') parts.push(strings.sync.recoveredResumed);
  if (project.recovery?.kind === 'stashed') parts.push(strings.sync.recoveredStashed(project.recovery.path));
  if (project.reclaimedStaleLockFrom) parts.push(strings.sync.reclaimedLock(project.reclaimedStaleLockFrom));
  return parts.length > 0 ? parts.join(' ') : null;
}

export function StatusBar({ project, user, onOpenAudit, onOpenSettings }: StatusBarProps) {
  const patchProject = useOpenProjectStore((s) => s.patchProject);
  const [syncing, setSyncing] = useState(false);
  // Avisos únicos da abertura (lock obsoleto reivindicado — about.md, Seção
  // 6.3 — e edições recuperadas de uma sessão anterior), inicializados só na
  // primeira renderização deste projeto.
  const [message, setMessage] = useState<string | null>(() => initialMessage(project));

  async function handleSync() {
    if (syncing || project.readOnly) return;
    setSyncing(true);
    setMessage(null);
    try {
      const result = await syncProject(project, user);
      patchProject(project.id, { lastSyncAt: result.project.lastSyncAt, openedCanonicalMtimeMs: result.project.openedCanonicalMtimeMs });
      if (result.conflict) {
        setMessage(strings.sync.conflictWarning);
      } else if (!result.integrityOk) {
        setMessage(strings.sync.integrityError);
      }
    } catch (err) {
      console.error(err);
      if (err instanceof LockLostError) {
        patchProject(project.id, { readOnly: true, lockOwner: err.holder });
        setMessage(strings.sync.lockLost(err.holder.user_name));
        return;
      }
      const detail = err instanceof Error ? err.message : String(err);
      setMessage(`${strings.common.saveError} (${detail})`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="status-bar">
      {project.readOnly ? (
        <span className="badge badge--warning">{strings.sync.readOnly(project.lockOwner?.user_name ?? '?')}</span>
      ) : (
        <>
          <span className="badge badge--success">{strings.sync.editing}</span>
          <button type="button" className="btn-secondary" onClick={() => void handleSync()} disabled={syncing}>
            {syncing ? strings.sync.syncing : strings.sync.syncButton}
          </button>
        </>
      )}

      <span className="status-bar__meta">{project.lastSyncAt ? strings.sync.lastSync(formatTime(project.lastSyncAt)) : strings.sync.neverSynced}</span>

      <button type="button" className="icon-btn status-bar__audit-link" onClick={onOpenSettings}>
        {strings.projectSettings.title}
      </button>

      <button type="button" className="icon-btn" onClick={onOpenAudit}>
        {strings.audit.title}
      </button>

      {message && <span className="status-bar__message">{message}</span>}
    </div>
  );
}
