import type { AuditLogRow } from '../../db/repositories/auditRepo';

const COLUMNS: (keyof AuditLogRow)[] = ['ts', 'user_name', 'user_email', 'action', 'entity_type', 'entity_id', 'entity_label', 'changes_json', 'app_version'];

// Campos como user_name, entity_label e changes_json vêm de texto livre
// digitado pelo usuário (nome de projeto/sessão/bowtie, descrições) — um
// valor começando com =, +, - ou @ seria interpretado como fórmula por
// Excel/Sheets ao abrir o CSV (CSV injection). Prefixar com aspas simples
// neutraliza sem alterar o valor visualmente.
const FORMULA_TRIGGER = /^[=+\-@]/;

function escapeCsvValue(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_TRIGGER.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function auditLogToCsv(rows: AuditLogRow[]): string {
  const header = COLUMNS.join(',');
  const lines = rows.map((row) => COLUMNS.map((col) => escapeCsvValue(row[col])).join(','));
  return [header, ...lines].join('\n');
}
