import { FormEvent, useEffect, useState } from 'react';
import { createBarrierType, deleteBarrierType, listBarrierTypes } from '../../db/repositories/barrierTypeRepo';
import type { BarrierTypeRow } from '../../db/repositories/barrierTypeRepo';
import type { OpenProject } from '../../db/repositories/projectRepo';
import { strings } from '../../i18n/strings.pt-BR';
import type { CurrentUser } from '../../store/currentUserStore';
import { useDialog } from '../ui/DialogProvider';

export function BarrierTypesSection({ project, user }: { project: OpenProject; user: CurrentUser }) {
  const { confirm } = useDialog();
  const [types, setTypes] = useState<BarrierTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, [project.dbPath]);

  async function refresh() {
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
    if (saving) return;
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
    if (!(await confirm(strings.barrierTypes.confirmDelete(type.label)))) return;
    try {
      await deleteBarrierType(project.dbPath, type, user);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  return (
    <section className="panel settings-section">
      <h3 className="section-title">{strings.barrierTypes.title}</h3>

      {error && <p className="error-text">{error}</p>}

      {loading ? null : types.length === 0 ? (
        <p className="empty-state">{strings.barrierTypes.empty}</p>
      ) : (
        <ul className="settings-list">
          {types.map((type) => (
            <li className="settings-list__item" key={type.id}>
              <span className="settings-list__label">{type.label}</span>
              {!project.readOnly && (
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => void handleDelete(type)}>
                  {strings.common.delete}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!project.readOnly && (
        <form className="settings-add" onSubmit={handleCreate}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={strings.barrierTypes.namePlaceholder}
            aria-label={strings.barrierTypes.nameLabel}
          />
          <button type="submit" disabled={saving}>
            {strings.barrierTypes.addSubmit}
          </button>
        </form>
      )}
    </section>
  );
}
