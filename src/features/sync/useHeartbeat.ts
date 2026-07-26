import { useEffect } from 'react';
import { HEARTBEAT_BEAT_MS, touchHeartbeat } from '../../db/lockRepo';
import type { OpenProject } from '../../db/repositories/projectRepo';

// Batida automática do lock (about.md, Seção 6.3) enquanto o projeto está
// aberto em modo de edição. Somente leitura não bate heartbeat — não é dono
// do lock.
export function useHeartbeat(project: OpenProject | null) {
  const dbFile = project?.dbFile;
  const readOnly = project?.readOnly ?? true;

  useEffect(() => {
    if (!dbFile || readOnly) return;

    const interval = setInterval(() => {
      void touchHeartbeat(dbFile);
    }, HEARTBEAT_BEAT_MS);

    return () => clearInterval(interval);
  }, [dbFile, readOnly]);
}
