import { FormEvent, useEffect, useState } from 'react';
import { createBowtie, deleteBowtie, listBowties, updateBowtie } from '../../db/repositories/bowtieRepo';
import { useDialog } from '../ui/DialogProvider';
import { strings } from '../../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../../store/currentUserStore';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';
import type { Bowtie } from '../../types/domain';

export function BowtiesScreen() {
  const user = useCurrentUserStore((s) => s.user);
  const project = useOpenProjectStore((s) => s.project);
  const view = useNavStore((s) => s.view);
  const goToEditor = useNavStore((s) => s.goToEditor);
  const { confirm } = useDialog();
  const sessionId = view.screen === 'bowties' ? view.sessionId : null;
  const sessionName = view.screen === 'bowties' ? view.sessionName : '';

  const [bowties, setBowties] = useState<Bowtie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hazard, setHazard] = useState('');
  const [topEvent, setTopEvent] = useState('');
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameDescription, setRenameDescription] = useState('');

  useEffect(() => {
    void refresh();
  }, [sessionId]);

  async function refresh() {
    if (!project || !sessionId) return;
    setLoading(true);
    try {
      setBowties(await listBowties(project.dbPath, sessionId));
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
    if (!user || !project || !sessionId || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(strings.bowties.nameRequired);
      return;
    }

    setSaving(true);
    try {
      await createBowtie(
        project.dbPath,
        sessionId,
        {
          name: trimmedName,
          description: description.trim() || null,
          hazard: hazard.trim() || null,
          top_event: topEvent.trim() || null,
        },
        user,
      );
      setName('');
      setDescription('');
      setHazard('');
      setTopEvent('');
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bowtie: Bowtie) {
    if (!user) return;
    if (!project) return;
    if (!(await confirm(strings.bowties.confirmDelete(bowtie.name)))) return;
    try {
      await deleteBowtie(project.dbPath, bowtie, user);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function submitRename(bowtie: Bowtie) {
    if (!user || !project) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      await updateBowtie(
        project.dbPath,
        bowtie,
        { name: trimmed, description: renameDescription.trim() || null, hazard: bowtie.hazard, top_event: bowtie.top_event },
        user,
      );
      setRenamingId(null);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  if (!project || !sessionId) return null;

  return (
    <div className="screen">
      <div className="screen__header">
        <h2>{strings.bowties.title}</h2>
        <p>{strings.bowties.subtitle(sessionName)}</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? null : bowties.length === 0 ? (
        <p className="empty-state">{strings.bowties.empty}</p>
      ) : (
        <div className="list">
          {bowties.map((bowtie) => (
            <div className="list-item" key={bowtie.id}>
              {renamingId === bowtie.id ? (
                <form
                  className="form"
                  style={{ flex: 1 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitRename(bowtie);
                  }}
                >
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                  <textarea
                    value={renameDescription}
                    onChange={(e) => setRenameDescription(e.target.value)}
                    placeholder={strings.bowties.descriptionPlaceholder}
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
                  <button className="list-item__main" onClick={() => goToEditor(sessionId, sessionName, bowtie.id, bowtie.name)}>
                    <span className="list-item__title">{bowtie.name}</span>
                    <span className="list-item__meta">{bowtie.top_event ?? strings.bowties.noTopEvent}</span>
                  </button>
                  {!project.readOnly && (
                    <div className="list-item__actions">
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setRenamingId(bowtie.id);
                          setRenameValue(bowtie.name);
                          setRenameDescription(bowtie.description ?? '');
                        }}
                      >
                        {strings.common.rename}
                      </button>
                      <button className="icon-btn icon-btn--danger" onClick={() => void handleDelete(bowtie)}>
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
          <p className="section-title">{strings.bowties.createTitle}</p>
          <form className="form" onSubmit={handleCreate}>
            <label className="field">
              {strings.bowties.nameLabel}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={strings.bowties.namePlaceholder} />
            </label>
            <div className="form__row">
              <label className="field">
                {strings.bowties.hazardLabel}
                <input value={hazard} onChange={(e) => setHazard(e.target.value)} placeholder={strings.bowties.hazardPlaceholder} />
              </label>
              <label className="field">
                {strings.bowties.topEventLabel}
                <input value={topEvent} onChange={(e) => setTopEvent(e.target.value)} placeholder={strings.bowties.topEventPlaceholder} />
              </label>
            </div>
            <label className="field">
              {strings.bowties.descriptionLabel}
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={strings.bowties.descriptionPlaceholder} />
            </label>
            <div className="form__actions">
              <button type="submit" disabled={saving}>
                {strings.bowties.createSubmit}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
