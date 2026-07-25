import type { Edge } from '@xyflow/react';
import type { Bowtie, Consequence, MitigativeBarrier, PreventiveBarrier, Threat } from '../../../types/domain';
import type { BowtieNodeData } from './types';

// Estrutura de domínio já carregada, agrupada por pai — a mesma forma serve
// para derivar o grafo (este arquivo) e para calcular o layout (layout.ts).
export interface BowtieGraphData {
  bowtie: Bowtie;
  threats: Threat[];
  preventiveBarriersByThreat: Record<string, PreventiveBarrier[]>;
  consequences: Consequence[];
  mitigativeBarriersByConsequence: Record<string, MitigativeBarrier[]>;
}

export interface RawNode {
  id: string;
  data: BowtieNodeData;
}

// Deriva nós e arestas a partir do modelo relacional (about.md, Seção 7.1).
// Não calcula posições — isso é responsabilidade de layout.ts.
export function deriveGraph(graph: BowtieGraphData): { nodes: RawNode[]; edges: Edge[] } {
  const nodes: RawNode[] = [{ id: 'top-event', data: { kind: 'top-event', bowtie: graph.bowtie } }];
  const edges: Edge[] = [];

  for (const threat of graph.threats) {
    const threatNodeId = `threat:${threat.id}`;
    nodes.push({ id: threatNodeId, data: { kind: 'threat', threat } });

    let previousId = threatNodeId;
    for (const barrier of graph.preventiveBarriersByThreat[threat.id] ?? []) {
      const barrierNodeId = `prev-barrier:${barrier.id}`;
      nodes.push({ id: barrierNodeId, data: { kind: 'prevention-barrier', barrier, threatId: threat.id } });
      edges.push({ id: `${previousId}->${barrierNodeId}`, source: previousId, target: barrierNodeId });
      previousId = barrierNodeId;
    }
    edges.push({ id: `${previousId}->top-event`, source: previousId, target: 'top-event' });
  }

  for (const consequence of graph.consequences) {
    const consequenceNodeId = `consequence:${consequence.id}`;
    nodes.push({ id: consequenceNodeId, data: { kind: 'consequence', consequence } });

    let previousId = 'top-event';
    for (const barrier of graph.mitigativeBarriersByConsequence[consequence.id] ?? []) {
      const barrierNodeId = `mit-barrier:${barrier.id}`;
      nodes.push({ id: barrierNodeId, data: { kind: 'mitigation-barrier', barrier, consequenceId: consequence.id } });
      edges.push({ id: `${previousId}->${barrierNodeId}`, source: previousId, target: barrierNodeId });
      previousId = barrierNodeId;
    }
    edges.push({ id: `${previousId}->${consequenceNodeId}`, source: previousId, target: consequenceNodeId });
  }

  return { nodes, edges };
}
