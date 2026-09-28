import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { strings } from '../../../i18n/strings.pt-BR';
import type { Category, CategoryKind } from '../../../types/domain';
import { categoryColorHex } from '../../categories/palette';
import { filterKey, uncategorizedKey } from './categoryFilter';

interface CategoryFilterProps {
  categories: Category[];
  hidden: ReadonlySet<string>;
  onChange: (hidden: Set<string>) => void;
}

const GROUPS: { kind: CategoryKind; title: string }[] = [
  { kind: 'threat', title: strings.categories.threatsGroup },
  { kind: 'consequence', title: strings.categories.consequencesGroup },
];

export function CategoryFilter({ categories, hidden, onChange }: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as globalThis.Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Conta só chaves que ainda existem — uma categoria oculta que foi
  // excluída depois não deve continuar contando no botão.
  const validKeys = new Set([...categories.map((c) => c.id), uncategorizedKey('threat'), uncategorizedKey('consequence')]);
  const hiddenCount = [...hidden].filter((key) => validKeys.has(key)).length;

  function toggle(key: string) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  return (
    <div className="category-filter" ref={rootRef}>
      <button type="button" className="btn-secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {hiddenCount > 0 ? strings.categories.filterButtonActive(hiddenCount) : strings.categories.filterButton}
      </button>

      {open && (
        <div className="category-filter__panel">
          <p className="category-filter__hint">{strings.categories.filterHint}</p>
          {GROUPS.map(({ kind, title }) => (
            <fieldset key={kind} className="category-filter__group">
              <legend>{title}</legend>
              {categories
                .filter((c) => c.kind === kind)
                .map((category) => (
                  <label key={category.id} className="category-filter__option">
                    <input type="checkbox" checked={!hidden.has(filterKey(kind, category.id))} onChange={() => toggle(category.id)} />
                    <span className="category-dot" style={{ '--category-color': categoryColorHex(category.color) } as CSSProperties} />
                    {category.label}
                  </label>
                ))}
              <label className="category-filter__option">
                <input type="checkbox" checked={!hidden.has(uncategorizedKey(kind))} onChange={() => toggle(uncategorizedKey(kind))} />
                <span className="category-dot category-dot--empty" />
                {strings.categories.none}
              </label>
            </fieldset>
          ))}
          {hiddenCount > 0 && (
            <button type="button" className="icon-btn" onClick={() => onChange(new Set())}>
              {strings.categories.filterShowAll}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
