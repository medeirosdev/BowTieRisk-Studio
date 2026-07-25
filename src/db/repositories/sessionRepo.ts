import type { CurrentUser } from '../../store/currentUserStore';
import type { Session } from '../../types/domain';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { newId } from '../ids';

export async function listSessions(dbPath: string, projectId: string): Promise<Session[]> {
  const db = await getDbAt(dbPath);
  return db.select<Session[]>('SELECT * FROM sessions WHERE project_id = $1 ORDER BY created_at', [projectId]);
}

export async function createSession(
  dbPath: string,
  projectId: string,
  name: string,
  description: string | null,
  user: CurrentUser,
): Promise<Session> {
  const db = await getDbAt(dbPath);
  const id = newId();
  const now = new Date().toISOString();

  await db.execute(
    'INSERT INTO sessions (id, project_id, name, description, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, projectId, name, description, user.name, now],
  );

  const session: Session = {
    id,
    project_id: projectId,
    name,
    description,
    created_by: user.name,
    created_at: now,
    updated_by: null,
    updated_at: null,
  };
  await writeAudit(db, user, { action: 'CREATE', entityType: 'session', entityId: id, entityLabel: name, after: session });
  return session;
}

export async function renameSession(dbPath: string, session: Session, newName: string, description: string | null, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  const now = new Date().toISOString();

  await db.execute('UPDATE sessions SET name = $1, description = $2, updated_by = $3, updated_at = $4 WHERE id = $5', [
    newName,
    description,
    user.name,
    now,
    session.id,
  ]);
  await writeAudit(db, user, {
    action: 'UPDATE',
    entityType: 'session',
    entityId: session.id,
    entityLabel: newName,
    before: session,
    after: { ...session, name: newName, description },
  });
}

export async function deleteSession(dbPath: string, session: Session, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('DELETE FROM sessions WHERE id = $1', [session.id]);
  await writeAudit(db, user, { action: 'DELETE', entityType: 'session', entityId: session.id, entityLabel: session.name, before: session });
}
