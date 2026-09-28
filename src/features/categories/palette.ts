// Paleta fixa e pequena de propósito: tons médios que continuam legíveis
// tanto no tema claro quanto no escuro. O banco guarda só a chave (ex.:
// "blue"), então dá pra ajustar o tom aqui sem migrar dado nenhum.
export const CATEGORY_COLORS = [
  { key: 'red', label: 'Vermelho', hex: '#e05a4f' },
  { key: 'orange', label: 'Laranja', hex: '#e8893a' },
  { key: 'yellow', label: 'Amarelo', hex: '#d6ad2b' },
  { key: 'green', label: 'Verde', hex: '#45a868' },
  { key: 'teal', label: 'Turquesa', hex: '#2c9faa' },
  { key: 'blue', label: 'Azul', hex: '#4d7fd8' },
  { key: 'purple', label: 'Roxo', hex: '#9366d4' },
  { key: 'gray', label: 'Cinza', hex: '#8a93a3' },
] as const;

export type CategoryColorKey = (typeof CATEGORY_COLORS)[number]['key'];

export const DEFAULT_CATEGORY_COLOR: CategoryColorKey = 'blue';

export function categoryColorHex(key: string): string {
  return CATEGORY_COLORS.find((c) => c.key === key)?.hex ?? CATEGORY_COLORS[CATEGORY_COLORS.length - 1].hex;
}
