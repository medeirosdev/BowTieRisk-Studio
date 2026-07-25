import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { BowtieNodeData } from '../types';

type ConsequenceNodeType = Node<Extract<BowtieNodeData, { kind: 'consequence' }>, 'consequence'>;

export function ConsequenceNode({ data, selected }: NodeProps<ConsequenceNodeType>) {
  return (
    <div className={`flow-node flow-node--consequence${selected ? ' flow-node--selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-node__title">{data.consequence.label}</div>
    </div>
  );
}
