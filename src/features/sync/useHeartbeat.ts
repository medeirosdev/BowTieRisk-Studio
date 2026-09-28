import { useEffect, useRef } from 'react';
import { HEARTBEAT_BEAT_MS, readLock, touchHeartbeat } from '../../db/lockRepo';
import type { LockInfo } from '../../db/lockRepo';
import type { OpenProject } from '../../db/repositories/projectRepo';
import type { CurrentUser } from '../../store/currentUserStore';

// Batida automática do lock (about.md, Seção 6.3) enquanto o projeto está
// aberto em modo de edição. Somente leitura não bate heartbeat — não é dono
// do lock. Se a batida descobrir que outra pessoa assumiu o projeto (nosso
// lock ficou obsoleto), avisa via onLost e para de bater.
export function useHeartbeat(project: OpenProject | null, user: CurrentUser | null, onLost: (holder: LockInfo) => void) {
  const dbFile = project?.dbFile;
  const readOnly = project?.readOnly ?? true;
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;

  useEffect(() => {
    if (!dbFile || readOnly || !user) return;

    let stopped = false;
    const interval = setInterval(() => {
      void touchHeartbeat(dbFile, user)
        .then(async (result) => {
          if (result !== 'lost' || stopped) return;
          stopped = true;
          clearInterval(interval);
          const holder = await readLock(dbFile);
          if (holder) onLostRef.current(holder);
        })
        .catch((err) => console.error(err));
    }, HEARTBEAT_BEAT_MS);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [dbFile, readOnly, user]);
}
