import type { CurrentUser } from '../../store/currentUserStore';
import type { Threat } from '../../types/domain';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { newId } from '../ids';

export async function listThreats(dbPath: string, bowtieId: string): Promise<Threat[]> {
  const db = await getDbAt(dbPath);
  return db.select<Threat[]>('SELECT * FROM threats WHERE bowtie_id = $1 ORDER BY order_index', [bowtieId]);
}

export async function createThreat(dbPath: string, bowtieId: string, label: string, description: string | null, user: CurrentUser): Promise<Threat> {
  const db = await getDbAt(dbPath);
  const [{ nextIndex }] = await db.select<{ nextIndex: number }[]>(
    'SELECT COALESCE(MAX(order_index) + 1, 0) as nextIndex FROM threats WHERE bowtie_id = $1',
    [bowtieId],
  );

  const id = newId();
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO threats (id, bowtie_id, label, description, order_index, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, bowtieId, label, description, nextIndex, user.name, now],
  );

  const threat: Threat = {
    id,
    bowtie_id: bowtieId,
    label,
    description,
    order_index: nextIndex,
    created_by: user.name,
    created_at: now,
    updated_by: null,
    updated_at: null,
  };
  await writeAudit(db, user, { action: 'CREATE', entityType: 'threat', entityId: id, entityLabel: label, after: threat });
  return threat;
}

export async function updateThreat(dbPath: string, threat: Threat, label: string, description: string | null, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  const now = new Date().toISOString();
  await db.execute('UPDATE threats SET label = $1, description = $2, updated_by = $3, updated_at = $4 WHERE id = $5', [
    label,
    description,
    user.name,
    now,
    threat.id,
  ]);
  await writeAudit(db, user, {
    action: 'UPDATE',
    entityType: 'threat',
    entityId: threat.id,
    entityLabel: label,
    before: threat,
    after: { ...threat, label, description },
  });
}

export async function deleteThreat(dbPath: string, threat: Threat, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('DELETE FROM threats WHERE id = $1', [threat.id]);
  await writeAudit(db, user, { action: 'DELETE', entityType: 'threat', entityId: threat.id, entityLabel: threat.label, before: threat });
}

export async function reorderThreat(dbPath: string, threats: Threat[], threatId: string, direction: 'up' | 'down', user: CurrentUser): Promise<void> {
  const index = threats.findIndex((t) => t.id === threatId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= threats.length) return;

  const db = await getDbAt(dbPath);
  const a = threats[index];
  const b = threats[swapWith];
  await db.execute('UPDATE threats SET order_index = $1 WHERE id = $2', [b.order_index, a.id]);
  await db.execute('UPDATE threats SET order_index = $1 WHERE id = $2', [a.order_index, b.id]);
  await writeAudit(db, user, { action: 'UPDATE', entityType: 'threat', entityId: a.id, entityLabel: a.label, before: { order_index: a.order_index }, after: { order_index: b.order_index } });
}
