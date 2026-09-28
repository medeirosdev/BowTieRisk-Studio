import type { CSSProperties } from 'react';
import type { Category } from '../../../../types/domain';
import { categoryColorHex } from '../../../categories/palette';

// Faixa lateral + etiqueta com o nome da categoria. A cor chega via
// --category-color pra que o CSS (canvas.css) decida onde aplicá-la.
export function categoryStyle(category: Category | null): CSSProperties | undefined {
  return category ? ({ '--category-color': categoryColorHex(category.color) } as CSSProperties) : undefined;
}

export function CategoryTag({ category }: { category: Category | null }) {
  if (!category) return null;
  return (
    <div className="flow-node__category">
      <span className="category-dot" />
      {category.label}
    </div>
  );
}
