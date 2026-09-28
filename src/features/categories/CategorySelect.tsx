import type { CSSProperties } from 'react';
import { strings } from '../../i18n/strings.pt-BR';
import type { Category } from '../../types/domain';
import { categoryColorHex } from './palette';

interface CategorySelectProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

// <option> não mostra cor de forma confiável entre plataformas, então a cor
// da categoria escolhida aparece numa bolinha ao lado do select.
export function CategorySelect({ categories, value, onChange }: CategorySelectProps) {
  const current = categories.find((c) => c.id === value) ?? null;
  const dotStyle = current ? ({ '--category-color': categoryColorHex(current.color) } as CSSProperties) : undefined;

  return (
    <div className="category-select">
      <span className={`category-dot${current ? '' : ' category-dot--empty'}`} style={dotStyle} />
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{strings.categories.none}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>
    </div>
  );
}
