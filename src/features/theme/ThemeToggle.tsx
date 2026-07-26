import { strings } from '../../i18n/strings.pt-BR';
import { useThemeStore } from '../../store/themeStore';
import type { ThemePreference } from '../../store/themeStore';
import { saveSavedTheme } from './themeSettings';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: strings.theme.system },
  { value: 'light', label: strings.theme.light },
  { value: 'dark', label: strings.theme.dark },
];

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  function handleSelect(value: ThemePreference) {
    setTheme(value);
    void saveSavedTheme(value);
  }

  return (
    <div className="theme-toggle" role="radiogroup" aria-label={strings.theme.toggleLabel}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          className={`theme-toggle__option${theme === option.value ? ' theme-toggle__option--active' : ''}`}
          onClick={() => handleSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
