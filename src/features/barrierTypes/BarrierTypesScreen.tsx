import { FormEvent, useEffect, useState } from 'react';
import { createBarrierType, deleteBarrierType, listBarrierTypes } from '../../db/repositories/barrierTypeRepo';
import type { BarrierTypeRow } from '../../db/repositories/barrierTypeRepo';
import { strings } from '../../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../../store/currentUserStore';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';
import { useDialog } from '../ui/DialogProvider';

export function BarrierTypesScreen() {
  const project = useOpenProjectStore((s) => s.project);
  const user = useCurrentUserStore((s) => s.user);
  const goBack = useNavStore((s) => s.goBackFromBarrierTypes);
  const { confirm } = useDialog();

  const [types, setTypes] = useState<BarrierTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, [project?.dbPath]);

  async function refresh() {
    if (!project) return;
    setLoading(true);
    try {
      setTypes(await listBarrierTypes(project.dbPath));
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
    if (!project || !user || saving) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError(strings.barrierTypes.nameRequired);
      return;
    }
    if (types.some((t) => t.label.toLowerCase() === trimmed.toLowerCase())) {
      setError(strings.barrierTypes.duplicate);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createBarrierType(project.dbPath, trimmed, user);
      setLabel('');
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type: BarrierTypeRow) {
    if (!project || !user) return;
    if (!(await confirm(strings.barrierTypes.confirmDelete(type.label)))) return;
    try {
      await deleteBarrierType(project.dbPath, type, user);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  if (!project) return null;

  return (
    <div className="screen" style={{ maxWidth: 640 }}>
      <div className="screen__header">
        <div className="audit-header">
          <div>
            <h2>{strings.barrierTypes.title}</h2>
            <p>{strings.barrierTypes.subtitle(project.name)}</p>
          </div>
          <button type="button" className="btn-secondary" onClick={goBack}>
            {strings.common.back}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? null : types.length === 0 ? (
        <p className="empty-state">{strings.barrierTypes.empty}</p>
      ) : (
        <div className="list">
          {types.map((type) => (
            <div className="list-item" key={type.id}>
              <span className="list-item__title">{type.label}</span>
              {!project.readOnly && (
                <div className="list-item__actions">
                  <button className="icon-btn icon-btn--danger" onClick={() => void handleDelete(type)}>
                    {strings.common.delete}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!project.readOnly && (
        <div className="panel">
          <p className="section-title">{strings.barrierTypes.addTitle}</p>
          <form className="form" onSubmit={handleCreate}>
            <label className="field">
              {strings.barrierTypes.nameLabel}
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={strings.barrierTypes.namePlaceholder} />
            </label>
            <div className="form__actions">
              <button type="submit" disabled={saving}>
                {strings.barrierTypes.addSubmit}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
