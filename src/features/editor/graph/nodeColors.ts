import type { Node } from '@xyflow/react';
import { categoryColorHex } from '../../categories/palette';
import type { BowtieNodeData } from './types';

// Cor de cada tipo de nó no minimap, espelhando as bordas do canvas
// principal (canvas.css .flow-node--*). Ameaça/consequência com categoria
// usam a cor dela, como a faixa lateral do nó.
export function minimapNodeColor(node: Node<BowtieNodeData>): string {
  switch (node.data.kind) {
    case 'threat':
      return node.data.category ? categoryColorHex(node.data.category.color) : 'var(--color-danger)';
    case 'consequence':
      return node.data.category ? categoryColorHex(node.data.category.color) : 'var(--color-warning)';
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
