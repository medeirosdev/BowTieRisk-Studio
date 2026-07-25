// Marcas diacriticas combinantes (categoria Unicode "Mn" = Mark, nonspacing),
// isoladas pelo normalize('NFD') abaixo -- essa e a forma robusta de remover
// acentos de qualquer letra acentuada.
const COMBINING_MARKS = /\p{Mn}/gu;

// Slug do nome do projeto -> nome de arquivo .db (about.md, Secao 6.6):
// minusculas, sem acentos, espacos viram hifen, hifens repetidos colapsam.
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
