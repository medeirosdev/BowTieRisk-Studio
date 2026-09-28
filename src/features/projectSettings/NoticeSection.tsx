import { FormEvent, useEffect, useState } from 'react';
import { clearProjectNotice, setProjectNotice } from '../../db/repositories/projectNoticeRepo';
import type { OpenProject } from '../../db/repositories/projectRepo';
import type { ProjectNotice } from '../../db/repositories/projectNoticeRepo';
import { strings } from '../../i18n/strings.pt-BR';
import type { CurrentUser } from '../../store/currentUserStore';
import { useDialog } from '../ui/DialogProvider';
import { formatNoticeDate } from './formatNoticeDate';

interface NoticeSectionProps {
  project: OpenProject;
  user: CurrentUser;
  onNoticeChange: (notice: ProjectNotice | null) => void;
}

export function NoticeSection({ project, user, onNoticeChange }: NoticeSectionProps) {
  const { confirm } = useDialog();
  const [text, setText] = useState(project.notice?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setText(project.notice?.text ?? ''), [project.notice?.text]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError(strings.notice.required);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const notice = await setProjectNotice(project.dbPath, project.id, project.notice, trimmed, user);
      onNoticeChange(notice);
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!(await confirm(strings.notice.confirmRemove, { confirmLabel: strings.notice.remove }))) return;
    try {
      await clearProjectNotice(project.dbPath, project.id, project.notice, user);
      onNoticeChange(null);
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  return (
    <section className="panel settings-section">
      <h3 className="section-title">{strings.notice.title}</h3>
      <p className="settings-section__hint">{strings.notice.hint}</p>

      {project.notice && (
        <p className="settings-section__meta">{strings.notice.byline(project.notice.by, formatNoticeDate(project.notice.at))}</p>
      )}

      {error && <p className="error-text">{error}</p>}

      {project.readOnly ? (
        !project.notice && <p className="empty-state">{strings.notice.empty}</p>
      ) : (
        <form className="form" onSubmit={handleSave}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={strings.notice.placeholder} />
          <div className="form__actions">
            {project.notice && (
              <button type="button" className="btn-danger" onClick={() => void handleRemove()}>
                {strings.notice.remove}
              </button>
            )}
            <button type="submit" disabled={saving}>
              {strings.notice.save}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
