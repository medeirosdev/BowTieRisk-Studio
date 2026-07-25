import type { NodeTypes } from '@xyflow/react';
import { BarrierNode } from './nodes/BarrierNode';
import { ConsequenceNode } from './nodes/ConsequenceNode';
import { ThreatNode } from './nodes/ThreatNode';
import { TopEventNode } from './nodes/TopEventNode';

export const nodeTypes: NodeTypes = {
  'top-event': TopEventNode,
  threat: ThreatNode,
  consequence: ConsequenceNode,
  'prevention-barrier': BarrierNode,
  'mitigation-barrier': BarrierNode,
};
