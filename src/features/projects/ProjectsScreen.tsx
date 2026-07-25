import { FormEvent, useEffect, useState } from 'react';
import { createProject, deleteProject, getProject, listProjects, openProject, renameProject, resolveProjectDbPath } from '../../db/repositories/projectRepo';
import type { ProjectIndexEntry } from '../../db/indexFile';
import { strings } from '../../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../../store/currentUserStore';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';

export function ProjectsScreen() {
  const user = useCurrentUserStore((s) => s.user);
  const setOpenProject = useOpenProjectStore((s) => s.setProject);
  const goToSessions = useNavStore((s) => s.goToSessions);

  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameDescription, setRenameDescription] = useState('');

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setProjects(await listProjects());
      setError(null);
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(entry: ProjectIndexEntry) {
    if (!user) return;
    try {
      const opened = await openProject(entry, user);
      setOpenProject(opened);
      goToSessions(opened.id, opened.name);
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!user || creating) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(strings.projects.nameRequired);
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const opened = await createProject(trimmedName, description.trim() || null, user);
      setName('');
      setDescription('');
      setOpenProject(opened);
      goToSessions(opened.id, opened.name);
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(entry: ProjectIndexEntry) {
    if (!user) return;
    if (!window.confirm(strings.projects.confirmDelete(entry.name))) return;
    try {
      await deleteProject(entry, user);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function startRename(entry: ProjectIndexEntry) {
    setRenamingId(entry.id);
    setRenameValue(entry.name);
    setRenameDescription('');
    try {
      const dbPath = await resolveProjectDbPath(entry);
      const project = await getProject(dbPath, entry.id);
      setRenameDescription(project.description ?? '');
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    }
  }

  async function submitRename(entry: ProjectIndexEntry) {
    if (!user) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      const dbPath = await resolveProjectDbPath(entry);
      await renameProject(dbPath, entry.id, trimmed, renameDescription.trim() || null, user);
      setRenamingId(null);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <h2>{strings.projects.title}</h2>
        <p>{strings.projects.subtitle}</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? null : projects.length === 0 ? (
        <p className="empty-state">{strings.projects.empty}</p>
      ) : (
        <div className="list">
          {projects.map((entry) => (
            <div className="list-item" key={entry.id}>
              {renamingId === entry.id ? (
                <form
                  className="form"
                  style={{ flex: 1 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitRename(entry);
                  }}
                >
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                  <textarea
                    value={renameDescription}
                    onChange={(e) => setRenameDescription(e.target.value)}
                    placeholder={strings.projects.descriptionPlaceholder}
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
                  <button className="list-item__main" onClick={() => void handleOpen(entry)}>
                    <span className="list-item__title">{entry.name}</span>
                    <span className="list-item__meta">
                      {strings.common.createdBy} {entry.created_by}
                    </span>
                  </button>
                  <div className="list-item__actions">
                    <button className="icon-btn" onClick={() => startRename(entry)}>
                      {strings.common.rename}
                    </button>
                    <button className="icon-btn icon-btn--danger" onClick={() => void handleDelete(entry)}>
                      {strings.common.delete}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <p className="section-title">{strings.projects.createTitle}</p>
        <form className="form" onSubmit={handleCreate}>
          <label className="field">
            {strings.projects.nameLabel}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={strings.projects.namePlaceholder} />
          </label>
          <label className="field">
            {strings.projects.descriptionLabel}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={strings.projects.descriptionPlaceholder} />
          </label>
          <div className="form__actions">
            <button type="submit" disabled={creating}>
              {strings.projects.createSubmit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
