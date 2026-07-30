import { useState } from 'react';
import { syncProject } from '../../db/repositories/projectRepo';
import type { OpenProject } from '../../db/repositories/projectRepo';
import { strings } from '../../i18n/strings.pt-BR';
import type { CurrentUser } from '../../store/currentUserStore';

interface StatusBarProps {
  project: OpenProject;
  user: CurrentUser;
  onProjectUpdate: (project: OpenProject) => void;
  onOpenAudit: () => void;
  onOpenBarrierTypes: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function StatusBar({ project, user, onProjectUpdate, onOpenAudit, onOpenBarrierTypes }: StatusBarProps) {
  const [syncing, setSyncing] = useState(false);
  // Aviso único ao reivindicar um lock obsoleto de outra pessoa (about.md,
  // Seção 6.3) — inicializado só na primeira renderização deste projeto.
  const [message, setMessage] = useState<string | null>(
    project.reclaimedStaleLockFrom ? strings.sync.reclaimedLock(project.reclaimedStaleLockFrom) : null,
  );

  async function handleSync() {
    if (syncing || project.readOnly) return;
    setSyncing(true);
    setMessage(null);
    try {
      const result = await syncProject(project, user);
      onProjectUpdate(result.project);
      if (result.conflict) {
        setMessage(strings.sync.conflictWarning);
      } else if (!result.integrityOk) {
        setMessage(strings.sync.integrityError);
      }
    } catch (err) {
      console.error(err);
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

      <button type="button" className="icon-btn status-bar__audit-link" onClick={onOpenBarrierTypes}>
        {strings.barrierTypes.title}
      </button>

      <button type="button" className="icon-btn" onClick={onOpenAudit}>
        {strings.audit.title}
      </button>

      {message && <span className="status-bar__message">{message}</span>}
    </div>
  );
}
