import type Database from '@tauri-apps/plugin-sql';
import type { CurrentUser } from '../store/currentUserStore';
import type { AuditAction } from '../types/enums';
import { newId } from './ids';

const APP_VERSION = '0.1.0';

interface AuditParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  before?: unknown;
  after?: unknown;
}

// Toda mutação escreve no audit_log (about.md, Seção 9). Chamar sempre
// dentro da mesma operação lógica que grava a alteração.
export async function writeAudit(db: Database, user: CurrentUser, params: AuditParams): Promise<void> {
  const changes =
    params.before !== undefined || params.after !== undefined
      ? JSON.stringify({ before: params.before ?? null, after: params.after ?? null })
      : null;

  await db.execute(
    `INSERT INTO audit_log (id, ts, user_name, user_email, action, entity_type, entity_id, entity_label, changes_json, app_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      newId(),
      new Date().toISOString(),
      user.name,
      user.email,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.entityLabel ?? null,
      changes,
      APP_VERSION,
    ],
  );
}
