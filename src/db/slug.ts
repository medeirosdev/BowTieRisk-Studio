// Marcas diacriticas combinantes (categoria Unicode "Mn" = Mark, nonspacing),
// isoladas pelo normalize('NFD') abaixo -- essa e a forma robusta de remover
// acentos de qualquer letra acentuada.
const COMBINING_MARKS = /\p{Mn}/gu;

// Limite do slug: o caminho completo (pasta do SharePoint sincronizada +
// bancos/ + <slug>.db.lock.json) precisa caber nos 260 caracteres do
// Windows, e a pasta do OneDrive sozinha já costuma passar de 100.
const MAX_SLUG_LENGTH = 60;

// Nomes reservados do Windows: "con.db", "nul.db" etc. não podem ser criados
// em nenhuma pasta, independentemente da extensão.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

// Slug do nome do projeto -> nome de arquivo .db (about.md, Secao 6.6):
// minusculas, sem acentos, espacos viram hifen, hifens repetidos colapsam.
export function slugify(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
  return WINDOWS_RESERVED.test(slug) ? `${slug}-projeto` : slug;
}
