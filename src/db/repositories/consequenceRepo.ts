import type { CurrentUser } from '../../store/currentUserStore';
import type { Consequence } from '../../types/domain';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { newId } from '../ids';

export async function listConsequences(dbPath: string, bowtieId: string): Promise<Consequence[]> {
  const db = await getDbAt(dbPath);
  return db.select<Consequence[]>('SELECT * FROM consequences WHERE bowtie_id = $1 ORDER BY order_index', [bowtieId]);
}

export async function createConsequence(dbPath: string, bowtieId: string, label: string, description: string | null, user: CurrentUser): Promise<Consequence> {
  const db = await getDbAt(dbPath);
  const [{ nextIndex }] = await db.select<{ nextIndex: number }[]>(
    'SELECT COALESCE(MAX(order_index) + 1, 0) as nextIndex FROM consequences WHERE bowtie_id = $1',
    [bowtieId],
  );

  const id = newId();
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO consequences (id, bowtie_id, label, description, order_index, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, bowtieId, label, description, nextIndex, user.name, now],
  );

  const consequence: Consequence = {
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
  await writeAudit(db, user, { action: 'CREATE', entityType: 'consequence', entityId: id, entityLabel: label, after: consequence });
  return consequence;
}

export async function updateConsequence(dbPath: string, consequence: Consequence, label: string, description: string | null, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  const now = new Date().toISOString();
  await db.execute('UPDATE consequences SET label = $1, description = $2, updated_by = $3, updated_at = $4 WHERE id = $5', [
    label,
    description,
    user.name,
    now,
    consequence.id,
  ]);
  await writeAudit(db, user, {
    action: 'UPDATE',
    entityType: 'consequence',
    entityId: consequence.id,
    entityLabel: label,
    before: consequence,
    after: { ...consequence, label, description },
  });
}

export async function deleteConsequence(dbPath: string, consequence: Consequence, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('DELETE FROM consequences WHERE id = $1', [consequence.id]);
  await writeAudit(db, user, { action: 'DELETE', entityType: 'consequence', entityId: consequence.id, entityLabel: consequence.label, before: consequence });
}

export async function reorderConsequence(dbPath: string, consequences: Consequence[], consequenceId: string, direction: 'up' | 'down', user: CurrentUser): Promise<void> {
  const index = consequences.findIndex((c) => c.id === consequenceId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= consequences.length) return;

  const db = await getDbAt(dbPath);
  const a = consequences[index];
  const b = consequences[swapWith];
  await db.execute('UPDATE consequences SET order_index = $1 WHERE id = $2', [b.order_index, a.id]);
  await db.execute('UPDATE consequences SET order_index = $1 WHERE id = $2', [a.order_index, b.id]);
  await writeAudit(db, user, { action: 'UPDATE', entityType: 'consequence', entityId: a.id, entityLabel: a.label, before: { order_index: a.order_index }, after: { order_index: b.order_index } });
}
