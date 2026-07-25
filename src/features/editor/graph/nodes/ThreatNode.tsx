import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { BowtieNodeData } from '../types';

type ThreatNodeType = Node<Extract<BowtieNodeData, { kind: 'threat' }>, 'threat'>;

export function ThreatNode({ data, selected }: NodeProps<ThreatNodeType>) {
  return (
    <div className={`flow-node flow-node--threat${selected ? ' flow-node--selected' : ''}`}>
      <div className="flow-node__title">{data.threat.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
