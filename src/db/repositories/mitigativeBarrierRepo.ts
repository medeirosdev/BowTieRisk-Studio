import type { CurrentUser } from '../../store/currentUserStore';
import type { MitigativeBarrier } from '../../types/domain';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { newId } from '../ids';
import type { BarrierInput } from './preventiveBarrierRepo';

export async function listMitigativeBarriers(dbPath: string, consequenceId: string): Promise<MitigativeBarrier[]> {
  const db = await getDbAt(dbPath);
  return db.select<MitigativeBarrier[]>('SELECT * FROM mitigative_barriers WHERE consequence_id = $1 ORDER BY order_index', [consequenceId]);
}

export async function createMitigativeBarrier(dbPath: string, consequenceId: string, input: BarrierInput, user: CurrentUser): Promise<MitigativeBarrier> {
  const db = await getDbAt(dbPath);
  const [{ nextIndex }] = await db.select<{ nextIndex: number }[]>(
    'SELECT COALESCE(MAX(order_index) + 1, 0) as nextIndex FROM mitigative_barriers WHERE consequence_id = $1',
    [consequenceId],
  );

  const id = newId();
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO mitigative_barriers (id, consequence_id, label, description, barrier_type, effectiveness, order_index, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [id, consequenceId, input.label, input.description, input.barrier_type, input.effectiveness, nextIndex, user.name, now],
  );

  const barrier: MitigativeBarrier = {
    id,
    consequence_id: consequenceId,
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
  await writeAudit(db, user, { action: 'CREATE', entityType: 'mitigative_barrier', entityId: id, entityLabel: input.label, after: barrier });
  return barrier;
}

export async function updateMitigativeBarrier(dbPath: string, barrier: MitigativeBarrier, input: BarrierInput, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  const now = new Date().toISOString();
  await db.execute(
    'UPDATE mitigative_barriers SET label = $1, description = $2, barrier_type = $3, effectiveness = $4, updated_by = $5, updated_at = $6 WHERE id = $7',
    [input.label, input.description, input.barrier_type, input.effectiveness, user.name, now, barrier.id],
  );
  await writeAudit(db, user, {
    action: 'UPDATE',
    entityType: 'mitigative_barrier',
    entityId: barrier.id,
    entityLabel: input.label,
    before: barrier,
    after: { ...barrier, ...input },
  });
}

export async function deleteMitigativeBarrier(dbPath: string, barrier: MitigativeBarrier, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('DELETE FROM mitigative_barriers WHERE id = $1', [barrier.id]);
  await writeAudit(db, user, { action: 'DELETE', entityType: 'mitigative_barrier', entityId: barrier.id, entityLabel: barrier.label, before: barrier });
}

export async function reorderMitigativeBarrier(dbPath: string, barriers: MitigativeBarrier[], barrierId: string, direction: 'up' | 'down', user: CurrentUser): Promise<void> {
  const index = barriers.findIndex((b) => b.id === barrierId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= barriers.length) return;

  const db = await getDbAt(dbPath);
  const a = barriers[index];
  const b = barriers[swapWith];
  await db.execute('UPDATE mitigative_barriers SET order_index = $1 WHERE id = $2', [b.order_index, a.id]);
  await db.execute('UPDATE mitigative_barriers SET order_index = $1 WHERE id = $2', [a.order_index, b.id]);
  await writeAudit(db, user, { action: 'UPDATE', entityType: 'mitigative_barrier', entityId: a.id, entityLabel: a.label, before: { order_index: a.order_index }, after: { order_index: b.order_index } });
}
