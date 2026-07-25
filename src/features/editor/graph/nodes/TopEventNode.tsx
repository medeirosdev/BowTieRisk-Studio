import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { strings } from '../../../../i18n/strings.pt-BR';
import type { BowtieNodeData } from '../types';

type TopEventNodeType = Node<Extract<BowtieNodeData, { kind: 'top-event' }>, 'top-event'>;

export function TopEventNode({ data, selected }: NodeProps<TopEventNodeType>) {
  return (
    <div className={`flow-node flow-node--top-event${selected ? ' flow-node--selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-node__eyebrow">{strings.editor.topEventLabel}</div>
      <div className="flow-node__title">{data.bowtie.top_event || strings.bowties.noTopEvent}</div>
      {data.bowtie.hazard && <div className="flow-node__meta">{data.bowtie.hazard}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
