import { strings } from '../../i18n/strings.pt-BR';
import { CATEGORY_COLORS } from './palette';

interface ColorSwatchesProps {
  value: string;
  onChange: (colorKey: string) => void;
  disabled?: boolean;
}

export function ColorSwatches({ value, onChange, disabled }: ColorSwatchesProps) {
  return (
    <div className="color-swatches" role="radiogroup">
      {CATEGORY_COLORS.map((color) => (
        <button
          key={color.key}
          type="button"
          role="radio"
          aria-checked={value === color.key}
          aria-label={strings.categories.colorOption(color.label)}
          title={color.label}
          className={`color-swatch${value === color.key ? ' color-swatch--active' : ''}`}
          style={{ background: color.hex }}
          disabled={disabled}
          onClick={() => onChange(color.key)}
        />
      ))}
    </div>
  );
}
