import { strings } from '../../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../../store/currentUserStore';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';
import { BarrierTypesSection } from './BarrierTypesSection';
import { CategoriesSection } from './CategoriesSection';
import { NoticeSection } from './NoticeSection';

// Tudo que é personalizável por projeto num lugar só: aviso geral,
// categorias de ameaças/consequências e tipos de barreira.
export function ProjectSettingsScreen() {
  const project = useOpenProjectStore((s) => s.project);
  const patchProject = useOpenProjectStore((s) => s.patchProject);
  const user = useCurrentUserStore((s) => s.user);
  const goBack = useNavStore((s) => s.goBackFromSettings);

  if (!project || !user) return null;

  return (
    <div className="screen settings-screen">
      <div className="screen__header">
        <div className="audit-header">
          <div>
            <h2>{strings.projectSettings.title}</h2>
            <p>{strings.projectSettings.subtitle(project.name)}</p>
          </div>
          <button type="button" className="btn-secondary" onClick={goBack}>
            {strings.common.back}
          </button>
        </div>
      </div>

      {project.readOnly && <p className="settings-section__hint">{strings.projectSettings.readOnlyHint}</p>}

      <NoticeSection project={project} user={user} onNoticeChange={(notice) => patchProject(project.id, { notice })} />
      <CategoriesSection project={project} user={user} kind="threat" />
      <CategoriesSection project={project} user={user} kind="consequence" />
      <BarrierTypesSection project={project} user={user} />
    </div>
  );
}
