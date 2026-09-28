import type { CurrentUser } from '../../store/currentUserStore';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';

// Aviso geral do projeto (ex.: "não mexer no bowtie X, em revisão"), um só
// por projeto. Mora na própria linha de `projects`, então viaja junto com o
// .db pelo SharePoint como qualquer outra alteração (precisa sincronizar).
export interface ProjectNotice {
  text: string;
  by: string;
  at: string;
}

export async function getProjectNotice(dbPath: string, projectId: string): Promise<ProjectNotice | null> {
  const db = await getDbAt(dbPath);
  const [row] = await db.select<{ notice: string | null; notice_by: string | null; notice_at: string | null }[]>(
    'SELECT notice, notice_by, notice_at FROM projects WHERE id = $1',
    [projectId],
  );
  if (!row?.notice) return null;
  return { text: row.notice, by: row.notice_by ?? '?', at: row.notice_at ?? '' };
}

export async function setProjectNotice(
  dbPath: string,
  projectId: string,
  previous: ProjectNotice | null,
  text: string,
  user: CurrentUser,
): Promise<ProjectNotice> {
  const db = await getDbAt(dbPath);
  const notice: ProjectNotice = { text, by: user.name, at: new Date().toISOString() };
  await db.execute('UPDATE projects SET notice = $1, notice_by = $2, notice_at = $3 WHERE id = $4', [
    notice.text,
    notice.by,
    notice.at,
    projectId,
  ]);
  await writeAudit(db, user, {
    action: 'UPDATE',
    entityType: 'project_notice',
    entityId: projectId,
    entityLabel: 'aviso do projeto',
    before: previous,
    after: notice,
  });
  return notice;
}

export async function clearProjectNotice(dbPath: string, projectId: string, previous: ProjectNotice | null, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('UPDATE projects SET notice = NULL, notice_by = NULL, notice_at = NULL WHERE id = $1', [projectId]);
  await writeAudit(db, user, {
    action: 'DELETE',
    entityType: 'project_notice',
    entityId: projectId,
    entityLabel: 'aviso do projeto',
    before: previous,
  });
}
