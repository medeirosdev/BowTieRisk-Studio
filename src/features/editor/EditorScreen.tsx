import { useCurrentUserStore } from '../../store/currentUserStore';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';
import { CanvasEditor } from './graph/CanvasEditor';

export function EditorScreen() {
  const user = useCurrentUserStore((s) => s.user);
  const project = useOpenProjectStore((s) => s.project);
  const view = useNavStore((s) => s.view);
  const bowtieId = view.screen === 'editor' ? view.bowtieId : null;

  if (!project || !bowtieId || !user) return null;

  return <CanvasEditor dbPath={project.dbPath} bowtieId={bowtieId} user={user} />;
}
