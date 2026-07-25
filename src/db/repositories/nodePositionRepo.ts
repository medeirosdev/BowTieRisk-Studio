import { getDbAt } from '../client';

export interface NodePositionRow {
  node_id: string;
  x: number;
  y: number;
}

// Overrides manuais de layout (about.md, Seção 5.3/7.2) — não são mutações
// de domínio auditáveis, só a posição de um nó no canvas.
export async function listNodePositions(dbPath: string, bowtieId: string): Promise<NodePositionRow[]> {
  const db = await getDbAt(dbPath);
  return db.select<NodePositionRow[]>('SELECT node_id, x, y FROM node_positions WHERE bowtie_id = $1', [bowtieId]);
}

export async function saveNodePosition(dbPath: string, bowtieId: string, nodeId: string, x: number, y: number): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute(
    `INSERT INTO node_positions (bowtie_id, node_id, x, y) VALUES ($1, $2, $3, $4)
     ON CONFLICT (bowtie_id, node_id) DO UPDATE SET x = excluded.x, y = excluded.y`,
    [bowtieId, nodeId, x, y],
  );
}
