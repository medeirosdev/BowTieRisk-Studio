import type { CurrentUser } from '../../store/currentUserStore';
import type { Effectiveness } from '../../types/enums';
import type { PreventiveBarrier } from '../../types/domain';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { newId } from '../ids';

export interface BarrierInput {
  label: string;
  description: string | null;
  barrier_type: string | null;
  effectiveness: Effectiveness;
}

export async function listPreventiveBarriers(dbPath: string, threatId: string): Promise<PreventiveBarrier[]> {
  const db = await getDbAt(dbPath);
  return db.select<PreventiveBarrier[]>('SELECT * FROM preventive_barriers WHERE threat_id = $1 ORDER BY order_index', [threatId]);
}

export async function createPreventiveBarrier(dbPath: string, threatId: string, input: BarrierInput, user: CurrentUser): Promise<PreventiveBarrier> {
  const db = await getDbAt(dbPath);
  const [{ nextIndex }] = await db.select<{ nextIndex: number }[]>(
    'SELECT COALESCE(MAX(order_index) + 1, 0) as nextIndex FROM preventive_barriers WHERE threat_id = $1',
    [threatId],
  );

  const id = newId();
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO preventive_barriers (id, threat_id, label, description, barrier_type, effectiveness, order_index, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [id, threatId, input.label, input.description, input.barrier_type, input.effectiveness, nextIndex, user.name, now],
  );

  const barrier: PreventiveBarrier = {
    id,
    threat_id: threatId,
    label: input.label,
    description: input.description,
    barrier_type: input.barrier_type,
    effectiveness: input.effectiveness,
    order_index: nextIndex,
    created_by: user.name,
    created_at: now,
    updated_by: null,
    updated_at: null,
  };
  await writeAudit(db, user, { action: 'CREATE', entityType: 'preventive_barrier', entityId: id, entityLabel: input.label, after: barrier });
  return barrier;
}

export async function updatePreventiveBarrier(dbPath: string, barrier: PreventiveBarrier, input: BarrierInput, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  const now = new Date().toISOString();
  await db.execute(
    'UPDATE preventive_barriers SET label = $1, description = $2, barrier_type = $3, effectiveness = $4, updated_by = $5, updated_at = $6 WHERE id = $7',
    [input.label, input.description, input.barrier_type, input.effectiveness, user.name, now, barrier.id],
  );
  await writeAudit(db, user, {
    action: 'UPDATE',
    entityType: 'preventive_barrier',
    entityId: barrier.id,
    entityLabel: input.label,
    before: barrier,
    after: { ...barrier, ...input },
  });
}

export async function deletePreventiveBarrier(dbPath: string, barrier: PreventiveBarrier, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('DELETE FROM preventive_barriers WHERE id = $1', [barrier.id]);
  await writeAudit(db, user, { action: 'DELETE', entityType: 'preventive_barrier', entityId: barrier.id, entityLabel: barrier.label, before: barrier });
}

export async function reorderPreventiveBarrier(dbPath: string, barriers: PreventiveBarrier[], barrierId: string, direction: 'up' | 'down', user: CurrentUser): Promise<void> {
  const index = barriers.findIndex((b) => b.id === barrierId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= barriers.length) return;

  const db = await getDbAt(dbPath);
  const a = barriers[index];
  const b = barriers[swapWith];
  await db.execute('UPDATE preventive_barriers SET order_index = $1 WHERE id = $2', [b.order_index, a.id]);
  await db.execute('UPDATE preventive_barriers SET order_index = $1 WHERE id = $2', [a.order_index, b.id]);
  await writeAudit(db, user, { action: 'UPDATE', entityType: 'preventive_barrier', entityId: a.id, entityLabel: a.label, before: { order_index: a.order_index }, after: { order_index: b.order_index } });
}

// Reordenação livre (drag no canvas): recebe a nova sequência completa de
// ids da cadeia e reatribui order_index 0..N-1 nessa ordem.
export async function reorderPreventiveBarriersFull(dbPath: string, orderedIds: string[], user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  for (let index = 0; index < orderedIds.length; index += 1) {
    await db.execute('UPDATE preventive_barriers SET order_index = $1 WHERE id = $2', [index, orderedIds[index]]);
  }
  await writeAudit(db, user, { action: 'UPDATE', entityType: 'preventive_barrier', entityLabel: 'reorder', after: { order: orderedIds } });
}
