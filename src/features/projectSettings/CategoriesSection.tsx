import type { CSSProperties } from 'react';
import { FormEvent, useEffect, useState } from 'react';
import { createCategory, deleteCategory, listCategories, updateCategoryColor } from '../../db/repositories/categoryRepo';
import type { OpenProject } from '../../db/repositories/projectRepo';
import { strings } from '../../i18n/strings.pt-BR';
import type { CurrentUser } from '../../store/currentUserStore';
import type { Category, CategoryKind } from '../../types/domain';
import { ColorSwatches } from '../categories/ColorSwatches';
import { DEFAULT_CATEGORY_COLOR, categoryColorHex } from '../categories/palette';
import { useDialog } from '../ui/DialogProvider';

interface CategoriesSectionProps {
  project: OpenProject;
  user: CurrentUser;
  kind: CategoryKind;
}

export function CategoriesSection({ project, user, kind }: CategoriesSectionProps) {
  const { confirm } = useDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [saving, setSaving] = useState(false);
  const readOnly = project.readOnly;

  useEffect(() => {
    void refresh();
  }, [project.dbPath, kind]);

  async function refresh() {
    setLoading(true);
    try {
      const all = await listCategories(project.dbPath);
      setCategories(all.filter((c) => c.kind === kind));
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
      setError(strings.categories.nameRequired);
      return;
    }
    if (categories.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())) {
      setError(strings.categories.duplicate);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createCategory(project.dbPath, kind, trimmed, color, user);
      setLabel('');
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleColorChange(category: Category, nextColor: string) {
    if (nextColor === category.color) return;
    try {
      await updateCategoryColor(project.dbPath, category, nextColor, user);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function handleDelete(category: Category) {
    if (!(await confirm(strings.categories.confirmDelete(category.label)))) return;
    try {
      await deleteCategory(project.dbPath, category, user);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  return (
    <section className="panel settings-section">
      <h3 className="section-title">{kind === 'threat' ? strings.categories.threatTitle : strings.categories.consequenceTitle}</h3>

      {error && <p className="error-text">{error}</p>}

      {loading ? null : categories.length === 0 ? (
        <p className="empty-state">{strings.categories.empty}</p>
      ) : (
        <ul className="settings-list">
          {categories.map((category) => (
            <li className="settings-list__item" key={category.id}>
              <span className="category-dot" style={{ '--category-color': categoryColorHex(category.color) } as CSSProperties} />
              <span className="settings-list__label">{category.label}</span>
              <ColorSwatches value={category.color} onChange={(next) => void handleColorChange(category, next)} disabled={readOnly} />
              {!readOnly && (
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => void handleDelete(category)}>
                  {strings.common.delete}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form className="settings-add" onSubmit={handleCreate}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={strings.categories.namePlaceholder} aria-label={strings.categories.label} />
          <ColorSwatches value={color} onChange={setColor} />
          <button type="submit" disabled={saving}>
            {strings.categories.add}
          </button>
        </form>
      )}
    </section>
  );
}
