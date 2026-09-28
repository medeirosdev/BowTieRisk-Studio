import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { BowtieNodeData } from '../types';
import { CategoryTag, categoryStyle } from './CategoryTag';

type ConsequenceNodeType = Node<Extract<BowtieNodeData, { kind: 'consequence' }>, 'consequence'>;

export function ConsequenceNode({ data, selected }: NodeProps<ConsequenceNodeType>) {
  const classes = ['flow-node', 'flow-node--consequence'];
  if (data.category) classes.push('flow-node--categorized');
  if (selected) classes.push('flow-node--selected');

  return (
    <div className={classes.join(' ')} style={categoryStyle(data.category)}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-node__title">{data.consequence.label}</div>
      <CategoryTag category={data.category} />
    </div>
  );
}
