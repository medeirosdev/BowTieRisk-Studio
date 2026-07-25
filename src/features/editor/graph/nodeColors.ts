import type { Node } from '@xyflow/react';
import type { BowtieNodeData } from './types';

// Cor de cada tipo de nó no minimap, espelhando as bordas do canvas
// principal (canvas.css .flow-node--*).
export function minimapNodeColor(node: Node<BowtieNodeData>): string {
  switch (node.data.kind) {
    case 'threat':
      return 'var(--color-danger)';
    case 'consequence':
      return 'var(--color-warning)';
    case 'top-event':
      return 'var(--color-accent)';
    case 'prevention-barrier':
      return 'var(--color-danger-soft)';
    case 'mitigation-barrier':
      return 'var(--color-warning-soft)';
    default:
      return 'var(--color-border)';
  }
}
