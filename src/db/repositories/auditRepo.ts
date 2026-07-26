import { getDbAt } from '../client';
import type { AuditAction } from '../../types/enums';

export interface AuditLogRow {
  id: string;
  ts: string;
  user_name: string;
  user_email: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  changes_json: string | null;
  app_version: string | null;
}

export interface AuditFilters {
  userEmail?: string;
  entityType?: string;
  action?: string;
  from?: string; // ISO, início do dia
  to?: string; // ISO, fim do dia
}

const MAX_ROWS = 300;

// Visualizador do audit_log (about.md, Seção 8, item 6) — filtrável por
// usuário, entidade e período. audit_log é append-only e vive dentro de
// cada projeto, então a consulta é sempre sobre a cópia de trabalho aberta.
export async function listAuditLog(dbPath: string, filters: AuditFilters): Promise<AuditLogRow[]> {
  const db = await getDbAt(dbPath);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.userEmail) {
    params.push(filters.userEmail);
    conditions.push(`user_email = $${params.length}`);
  }
  if (filters.entityType) {
    params.push(filters.entityType);
    conditions.push(`entity_type = $${params.length}`);
  }
  if (filters.action) {
    params.push(filters.action);
    conditions.push(`action = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`ts >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`ts <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<AuditLogRow[]>(`SELECT * FROM audit_log ${where} ORDER BY ts DESC LIMIT ${MAX_ROWS}`, params);
}

export async function listAuditUsers(dbPath: string): Promise<{ name: string; email: string }[]> {
  const db = await getDbAt(dbPath);
  return db.select<{ name: string; email: string }[]>(
    'SELECT DISTINCT user_name as name, user_email as email FROM audit_log ORDER BY user_name',
  );
}

export async function listAuditEntityTypes(dbPath: string): Promise<string[]> {
  const db = await getDbAt(dbPath);
  const rows = await db.select<{ entity_type: string }[]>('SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type');
  return rows.map((r) => r.entity_type);
}
