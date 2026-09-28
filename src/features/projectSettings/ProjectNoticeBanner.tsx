import type { ProjectNotice } from '../../db/repositories/projectNoticeRepo';
import { strings } from '../../i18n/strings.pt-BR';
import { formatNoticeDate } from './formatNoticeDate';

// Faixa fixa abaixo da barra de status, em todas as telas do projeto
// (inclusive o canvas), pra ninguém deixar de ver o aviso.
export function ProjectNoticeBanner({ notice }: { notice: ProjectNotice }) {
  return (
    <div className="notice-banner" role="status">
      <span className="badge badge--warning">{strings.notice.bannerLabel}</span>
      <span className="notice-banner__text">{notice.text}</span>
      <span className="notice-banner__meta">{strings.notice.byline(notice.by, formatNoticeDate(notice.at))}</span>
    </div>
  );
}
