import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { BowtieNodeData } from '../types';
import { CategoryTag, categoryStyle } from './CategoryTag';

type ThreatNodeType = Node<Extract<BowtieNodeData, { kind: 'threat' }>, 'threat'>;

export function ThreatNode({ data, selected }: NodeProps<ThreatNodeType>) {
  const classes = ['flow-node', 'flow-node--threat'];
  if (data.category) classes.push('flow-node--categorized');
  if (selected) classes.push('flow-node--selected');

  return (
    <div className={classes.join(' ')} style={categoryStyle(data.category)}>
      <div className="flow-node__title">{data.threat.label}</div>
      <CategoryTag category={data.category} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
