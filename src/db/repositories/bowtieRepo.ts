import type { CurrentUser } from '../../store/currentUserStore';
import type { Bowtie } from '../../types/domain';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { newId } from '../ids';

export interface BowtieInput {
  name: string;
  description: string | null;
  hazard: string | null;
  top_event: string | null;
}

export async function listBowties(dbPath: string, sessionId: string): Promise<Bowtie[]> {
  const db = await getDbAt(dbPath);
  return db.select<Bowtie[]>('SELECT * FROM bowties WHERE session_id = $1 ORDER BY created_at', [sessionId]);
}

export async function getBowtie(dbPath: string, bowtieId: string): Promise<Bowtie> {
  const db = await getDbAt(dbPath);
  const [bowtie] = await db.select<Bowtie[]>('SELECT * FROM bowties WHERE id = $1', [bowtieId]);
  if (!bowtie) {
    throw new Error(`Bowtie não encontrado: ${bowtieId}`);
  }
  return bowtie;
}

export async function createBowtie(dbPath: string, sessionId: string, input: BowtieInput, user: CurrentUser): Promise<Bowtie> {
  const db = await getDbAt(dbPath);
  const id = newId();
  const now = new Date().toISOString();

  await db.execute(
    'INSERT INTO bowties (id, session_id, name, description, hazard, top_event, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, sessionId, input.name, input.description, input.hazard, input.top_event, user.name, now],
  );

  const bowtie: Bowtie = {
    id,
    session_id: sessionId,
    name: input.name,
    description: input.description,
    hazard: input.hazard,
    top_event: input.top_event,
    created_by: user.name,
    created_at: now,
    updated_by: null,
    updated_at: null,
  };
  await writeAudit(db, user, { action: 'CREATE', entityType: 'bowtie', entityId: id, entityLabel: input.name, after: bowtie });
  return bowtie;
}

export async function updateBowtie(dbPath: string, bowtie: Bowtie, input: BowtieInput, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  const now = new Date().toISOString();

  await db.execute(
    'UPDATE bowties SET name = $1, description = $2, hazard = $3, top_event = $4, updated_by = $5, updated_at = $6 WHERE id = $7',
    [input.name, input.description, input.hazard, input.top_event, user.name, now, bowtie.id],
  );
  await writeAudit(db, user, {
    action: 'UPDATE',
    entityType: 'bowtie',
    entityId: bowtie.id,
    entityLabel: input.name,
    before: bowtie,
    after: { ...bowtie, ...input },
  });
}

export async function deleteBowtie(dbPath: string, bowtie: Bowtie, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('DELETE FROM bowties WHERE id = $1', [bowtie.id]);
  await writeAudit(db, user, { action: 'DELETE', entityType: 'bowtie', entityId: bowtie.id, entityLabel: bowtie.name, before: bowtie });
}
