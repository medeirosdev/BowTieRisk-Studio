import { FormEvent, useEffect, useState } from 'react';
import { createSession, deleteSession, listSessions, renameSession } from '../../db/repositories/sessionRepo';
import { useDialog } from '../ui/DialogProvider';
import { strings } from '../../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../../store/currentUserStore';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';
import type { Session } from '../../types/domain';

export function SessionsScreen() {
  const user = useCurrentUserStore((s) => s.user);
  const project = useOpenProjectStore((s) => s.project);
  const goToBowties = useNavStore((s) => s.goToBowties);
  const { confirm } = useDialog();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameDescription, setRenameDescription] = useState('');

  useEffect(() => {
    void refresh();
  }, [project?.id]);

  async function refresh() {
    if (!project) return;
    setLoading(true);
    try {
      setSessions(await listSessions(project.dbPath, project.id));
      setError(null);
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!user || !project || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(strings.sessions.nameRequired);
      return;
    }

    setSaving(true);
    try {
      await createSession(project.dbPath, project.id, trimmedName, description.trim() || null, user);
      setName('');
      setDescription('');
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(session: Session) {
    if (!user || !project) return;
    if (!(await confirm(strings.sessions.confirmDelete(session.name)))) return;
    try {
      await deleteSession(project.dbPath, session, user);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function submitRename(session: Session) {
    if (!user || !project) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      await renameSession(project.dbPath, session, trimmed, renameDescription.trim() || null, user);
      setRenamingId(null);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  if (!project) return null;

  return (
    <div className="screen">
      <div className="screen__header">
        <h2>{strings.sessions.title}</h2>
        <p>{strings.sessions.subtitle(project.name)}</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? null : sessions.length === 0 ? (
        <p className="empty-state">{strings.sessions.empty}</p>
      ) : (
        <div className="list">
          {sessions.map((session) => (
            <div className="list-item" key={session.id}>
              {renamingId === session.id ? (
                <form
                  className="form"
                  style={{ flex: 1 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitRename(session);
                  }}
                >
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                  <textarea
                    value={renameDescription}
                    onChange={(e) => setRenameDescription(e.target.value)}
                    placeholder={strings.sessions.descriptionPlaceholder}
                  />
                  <div className="form__actions">
                    <button type="button" className="btn-secondary" onClick={() => setRenamingId(null)}>
                      {strings.common.cancel}
                    </button>
                    <button type="submit">{strings.common.save}</button>
                  </div>
                </form>
              ) : (
                <>
                  <button className="list-item__main" onClick={() => goToBowties(session.id, session.name)}>
                    <span className="list-item__title">{session.name}</span>
                    <span className="list-item__meta">
                      {strings.common.createdBy} {session.created_by}
                    </span>
                  </button>
                  {!project.readOnly && (
                    <div className="list-item__actions">
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setRenamingId(session.id);
                          setRenameValue(session.name);
                          setRenameDescription(session.description ?? '');
                        }}
                      >
                        {strings.common.rename}
                      </button>
                      <button className="icon-btn icon-btn--danger" onClick={() => void handleDelete(session)}>
                        {strings.common.delete}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!project.readOnly && (
        <div className="panel">
          <p className="section-title">{strings.sessions.createTitle}</p>
          <form className="form" onSubmit={handleCreate}>
            <label className="field">
              {strings.sessions.nameLabel}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={strings.sessions.namePlaceholder} />
            </label>
            <label className="field">
              {strings.sessions.descriptionLabel}
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={strings.sessions.descriptionPlaceholder} />
            </label>
            <div className="form__actions">
              <button type="submit" disabled={saving}>
                {strings.sessions.createSubmit}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
