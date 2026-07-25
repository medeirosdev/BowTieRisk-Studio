import type { Node } from '@xyflow/react';
import type { BowtieGraphData, RawNode } from './deriveGraph';
import type { BowtieNodeData } from './types';

const COLUMN_WIDTH = 240;
const LANE_HEIGHT = 140;
const LANE_BASE_Y = 40;
const TOP_EVENT_X = 0;

export interface PositionOverride {
  nodeId: string;
  x: number;
  y: number;
}

// Layout determinístico por colunas (about.md, Seção 7.2): ameaças →
// barreiras preventivas → EVENTO DE TOPO → barreiras mitigatórias →
// consequências. Cada ameaça/consequência ocupa uma raia horizontal; suas
// barreiras herdam o Y da raia. `order_index` cresce a partir da extremidade
// de origem de cada cadeia (ameaça→topo à esquerda, topo→consequência à
// direita — ver comentários da migration), então a barreira order_index=0
// fica sempre adjacente à ameaça/ao topo, e a de maior order_index, mais
// perto do outro extremo da cadeia.
export function computeLayout(graph: BowtieGraphData, rawNodes: RawNode[], overrides: PositionOverride[] = []): Node<BowtieNodeData>[] {
  const positions = new Map<string, { x: number; y: number }>();

  const laneCount = Math.max(graph.threats.length, graph.consequences.length, 1);
  const topEventY = LANE_BASE_Y + ((laneCount - 1) / 2) * LANE_HEIGHT;
  positions.set('top-event', { x: TOP_EVENT_X, y: topEventY });

  graph.threats.forEach((threat, laneIndex) => {
    const laneY = LANE_BASE_Y + laneIndex * LANE_HEIGHT;
    const barriers = graph.preventiveBarriersByThreat[threat.id] ?? [];
    const chainLength = barriers.length;

    positions.set(`threat:${threat.id}`, { x: TOP_EVENT_X - (chainLength + 1) * COLUMN_WIDTH, y: laneY });

    barriers.forEach((barrier, i) => {
      const distanceFromTopEvent = chainLength - i;
      positions.set(`prev-barrier:${barrier.id}`, { x: TOP_EVENT_X - distanceFromTopEvent * COLUMN_WIDTH, y: laneY });
    });
  });

  graph.consequences.forEach((consequence, laneIndex) => {
    const laneY = LANE_BASE_Y + laneIndex * LANE_HEIGHT;
    const barriers = graph.mitigativeBarriersByConsequence[consequence.id] ?? [];
    const chainLength = barriers.length;

    positions.set(`consequence:${consequence.id}`, { x: TOP_EVENT_X + (chainLength + 1) * COLUMN_WIDTH, y: laneY });

    barriers.forEach((barrier, i) => {
      positions.set(`mit-barrier:${barrier.id}`, { x: TOP_EVENT_X + (i + 1) * COLUMN_WIDTH, y: laneY });
    });
  });

  // Overrides manuais (node_positions) aplicados por cima do layout calculado.
  for (const override of overrides) {
    positions.set(override.nodeId, { x: override.x, y: override.y });
  }

  return rawNodes.map((node) => ({
    id: node.id,
    type: node.data.kind,
    data: node.data,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
  }));
}
