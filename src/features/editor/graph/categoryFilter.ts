import type { CategoryKind } from '../../../types/domain';
import type { BowtieGraphData } from './deriveGraph';

// Chave de filtro de "sem categoria", uma por lado (ameaças e consequências
// têm listas de categorias separadas).
export function uncategorizedKey(kind: CategoryKind): string {
  return `__sem-categoria:${kind}`;
}

export function filterKey(kind: CategoryKind, categoryId: string | null): string {
  return categoryId ?? uncategorizedKey(kind);
}

// Nós que ficam transparentes com o filtro atual: a ameaça/consequência de
// uma categoria oculta e toda a sua cadeia de barreiras. O evento de topo
// nunca é afetado.
export function dimmedNodeIds(graph: BowtieGraphData, hidden: ReadonlySet<string>): Set<string> {
  const dimmed = new Set<string>();
  if (hidden.size === 0) return dimmed;

  for (const threat of graph.threats) {
    if (!hidden.has(filterKey('threat', threat.category_id))) continue;
    dimmed.add(`threat:${threat.id}`);
    for (const barrier of graph.preventiveBarriersByThreat[threat.id] ?? []) dimmed.add(`prev-barrier:${barrier.id}`);
  }
  for (const consequence of graph.consequences) {
    if (!hidden.has(filterKey('consequence', consequence.category_id))) continue;
    dimmed.add(`consequence:${consequence.id}`);
    for (const barrier of graph.mitigativeBarriersByConsequence[consequence.id] ?? []) dimmed.add(`mit-barrier:${barrier.id}`);
  }
  return dimmed;
}
