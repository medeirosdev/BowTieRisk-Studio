import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { EFFECTIVENESS_LABELS, EFFECTIVENESS_NOT_EVALUATED_LABEL } from '../../../../types/enums';
import type { BowtieNodeData } from '../types';

type BarrierNodeType = Node<Extract<BowtieNodeData, { kind: 'prevention-barrier' | 'mitigation-barrier' }>, 'prevention-barrier' | 'mitigation-barrier'>;

// Um único componente para os dois lados (about.md, Seção 7.4) — a cor
// distingue preventiva (esquerda) de mitigatória (direita).
export function BarrierNode({ data, selected }: NodeProps<BarrierNodeType>) {
  const isMitigation = data.kind === 'mitigation-barrier';
  const classes = ['flow-node', 'flow-node--barrier', isMitigation ? 'flow-node--mitigation' : 'flow-node--prevention'];
  if (selected) classes.push('flow-node--selected');

  return (
    <div className={classes.join(' ')}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-node__title">{data.barrier.label}</div>
      <div className="flow-node__meta">{data.barrier.barrier_type ?? '—'}</div>
      <div className="flow-node__meta">{data.barrier.effectiveness ? EFFECTIVENESS_LABELS[data.barrier.effectiveness] : EFFECTIVENESS_NOT_EVALUATED_LABEL}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
