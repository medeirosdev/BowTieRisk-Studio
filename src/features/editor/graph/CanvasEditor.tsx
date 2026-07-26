import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  getViewportForBounds,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBowtie } from '../../../db/repositories/bowtieRepo';
import { listNodePositions, saveNodePosition } from '../../../db/repositories/nodePositionRepo';
import { reorderPreventiveBarriersFull } from '../../../db/repositories/preventiveBarrierRepo';
import { reorderMitigativeBarriersFull } from '../../../db/repositories/mitigativeBarrierRepo';
import { slugify } from '../../../db/slug';
import { strings } from '../../../i18n/strings.pt-BR';
import type { CurrentUser } from '../../../store/currentUserStore';
import { useDialog } from '../../ui/DialogProvider';
import { useThemeStore } from '../../../store/themeStore';
import { deriveGraph } from './deriveGraph';
import type { BowtieGraphData } from './deriveGraph';
import { computeLayout } from './layout';
import { minimapNodeColor } from './nodeColors';
import { nodeTypes } from './nodeTypes';
import { consequenceRepo, mitigativeBarrierRepo, preventiveBarrierRepo, threatRepo } from './repoAdapters';
import { SidePanel } from './SidePanel';
import type { BowtieNodeData } from './types';
import './canvas.css';

const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 1000;
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

interface CanvasEditorProps {
  dbPath: string;
  bowtieId: string;
  user: CurrentUser;
  readOnly: boolean;
}

// A instância do React Flow só pode usar useReactFlow() dentro de um
// ReactFlowProvider — daqui vem a divisão externo/interno.
export function CanvasEditor(props: CanvasEditorProps) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasEditorInner({ dbPath, bowtieId, user, readOnly }: CanvasEditorProps) {
  const [graph, setGraph] = useState<BowtieGraphData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BowtieNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [creatingSide, setCreatingSide] = useState<'threat' | 'consequence' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { fitView } = useReactFlow();
  const previousNodeCount = useRef<number | null>(null);
  const { confirm, isOpen: isDialogOpen } = useDialog();
  const resolvedTheme = useThemeStore((s) => s.resolved);

  const load = useCallback(async () => {
    try {
      const [bowtie, threats, consequences, positions] = await Promise.all([
        getBowtie(dbPath, bowtieId),
        threatRepo.list(dbPath, bowtieId),
        consequenceRepo.list(dbPath, bowtieId),
        listNodePositions(dbPath, bowtieId),
      ]);

      const preventiveBarriersByThreat = Object.fromEntries(
        await Promise.all(threats.map(async (t) => [t.id, await preventiveBarrierRepo.list(dbPath, t.id)] as const)),
      );
      const mitigativeBarriersByConsequence = Object.fromEntries(
        await Promise.all(consequences.map(async (c) => [c.id, await mitigativeBarrierRepo.list(dbPath, c.id)] as const)),
      );

      const nextGraph: BowtieGraphData = { bowtie, threats, preventiveBarriersByThreat, consequences, mitigativeBarriersByConsequence };
      const { nodes: rawNodes, edges: nextEdges } = deriveGraph(nextGraph);
      const layouted = computeLayout(nextGraph, rawNodes, positions.map((p) => ({ nodeId: p.node_id, x: p.x, y: p.y })));

      setGraph(nextGraph);
      setNodes(layouted);
      setEdges(nextEdges);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    }
  }, [dbPath, bowtieId, setNodes, setEdges]);

  useEffect(() => {
    void load();
    setSelectedNodeId(null);
    setCreatingSide(null);
    previousNodeCount.current = null;
  }, [load]);

  // Reenquadra a view quando nós são adicionados/removidos, pra um item novo
  // não ficar invisível fora da área visível (ex.: criar uma ameaça enquanto
  // o zoom está distante numa parte já cheia do diagrama).
  useEffect(() => {
    if (previousNodeCount.current !== null && previousNodeCount.current !== nodes.length) {
      fitView({ duration: 300 });
    }
    previousNodeCount.current = nodes.length;
  }, [nodes.length, fitView]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const handleNodeClick = useCallback((_event: unknown, node: Node<BowtieNodeData>) => {
    setCreatingSide(null);
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setCreatingSide(null);
  }, []);

  // Barreiras não têm posição livre: arrastar uma barreira ao longo da
  // cadeia reordena (com base na posição X final entre as barreiras irmãs);
  // ao soltar, o layout recalcula e a barreira volta pra sua coluna exata.
  // Ameaças/consequências/evento de topo continuam com posição livre.
  const handleBarrierDragStop = useCallback(
    async (draggedNode: Node<BowtieNodeData>) => {
      const data = draggedNode.data;
      if (data.kind !== 'prevention-barrier' && data.kind !== 'mitigation-barrier') return;
      if (!graph) return;

      const isPrevention = data.kind === 'prevention-barrier';
      const parentId = isPrevention ? data.threatId : data.consequenceId;

      const siblingNodes = nodes.filter((n) => n.data.kind === data.kind && (isPrevention ? n.data.kind === 'prevention-barrier' && n.data.threatId === parentId : n.data.kind === 'mitigation-barrier' && n.data.consequenceId === parentId));

      const ordered = siblingNodes
        .map((n) => {
          const barrierId = n.data.kind === 'prevention-barrier' || n.data.kind === 'mitigation-barrier' ? n.data.barrier.id : '';
          return { id: barrierId, x: n.id === draggedNode.id ? draggedNode.position.x : n.position.x };
        })
        .sort((a, b) => a.x - b.x)
        .map((entry) => entry.id);

      const current = (isPrevention ? graph.preventiveBarriersByThreat[parentId] : graph.mitigativeBarriersByConsequence[parentId]) ?? [];
      const currentIds = current.map((b) => b.id);
      const changed = ordered.length === currentIds.length && ordered.some((id, i) => id !== currentIds[i]);

      if (changed) {
        try {
          if (isPrevention) {
            await reorderPreventiveBarriersFull(dbPath, ordered, user);
          } else {
            await reorderMitigativeBarriersFull(dbPath, ordered, user);
          }
        } catch (err) {
          console.error(err);
          setError(strings.common.saveError);
        }
      }
      await load();
    },
    [dbPath, graph, load, nodes, user],
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node<BowtieNodeData>) => {
      if (node.data.kind === 'prevention-barrier' || node.data.kind === 'mitigation-barrier') {
        void handleBarrierDragStop(node);
      } else {
        void saveNodePosition(dbPath, bowtieId, node.id, node.position.x, node.position.y);
      }
    },
    [dbPath, bowtieId, handleBarrierDragStop],
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedNode || readOnly) return;
    const data = selectedNode.data;
    if (data.kind === 'top-event') return;

    const label = data.kind === 'threat' ? data.threat.label : data.kind === 'consequence' ? data.consequence.label : data.barrier.label;
    if (!(await confirm(strings.editor.confirmDeleteItem(label)))) return;

    try {
      if (data.kind === 'threat') await threatRepo.remove(dbPath, data.threat, user);
      else if (data.kind === 'consequence') await consequenceRepo.remove(dbPath, data.consequence, user);
      else if (data.kind === 'prevention-barrier') await preventiveBarrierRepo.remove(dbPath, data.barrier, user);
      else if (data.kind === 'mitigation-barrier') await mitigativeBarrierRepo.remove(dbPath, data.barrier, user);

      setSelectedNodeId(null);
      await load();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }, [selectedNode, dbPath, user, load, readOnly, confirm]);

  // Atalhos: Esc fecha o painel lateral; Delete exclui o nó selecionado
  // (ignorado quando o foco está num campo de formulário).
  useEffect(() => {
    // Enquanto um diálogo de confirmação está aberto (ex.: Delete acionou a
    // exclusão do nó selecionado), Esc/Delete não devem também fechar o
    // painel ou disparar uma segunda exclusão por baixo do diálogo.
    if (isDialogOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && EDITABLE_TAGS.has(target.tagName)) return;

      if (event.key === 'Escape') {
        handleClosePanel();
      } else if (event.key === 'Delete' && selectedNodeId) {
        void handleDeleteSelected();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, handleClosePanel, handleDeleteSelected, isDialogOpen]);

  async function handleExportPng() {
    if (nodes.length === 0) return;
    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewportEl) return;

    const bounds = getNodesBounds(nodes);
    const viewport = getViewportForBounds(bounds, EXPORT_WIDTH, EXPORT_HEIGHT, 0.2, 2, 0.1);

    try {
      const dataUrl = await toPng(viewportEl, {
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        style: {
          width: `${EXPORT_WIDTH}px`,
          height: `${EXPORT_HEIGHT}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });
      const link = document.createElement('a');
      link.download = `${slugify(graph?.bowtie.name ?? 'bowtie') || 'bowtie'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      setError(strings.editor.exportError);
    }
  }

  if (!graph) {
    return error ? <p className="error-text">{error}</p> : null;
  }

  return (
    <div className="canvas-editor">
      <div className="canvas-editor__flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStop={handleNodeDragStop}
          nodesDraggable={!readOnly}
          colorMode={resolvedTheme}
          fitView
          minZoom={0.2}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={minimapNodeColor} pannable zoomable />
        </ReactFlow>

        <div className="canvas-toolbar">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedNodeId(null);
                  setCreatingSide('threat');
                }}
              >
                + {strings.editor.threatNoun}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedNodeId(null);
                  setCreatingSide('consequence');
                }}
              >
                + {strings.editor.consequenceNoun}
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={() => void handleExportPng()}>
            {strings.editor.exportPng}
          </button>
        </div>

        {error && <p className="error-text canvas-editor__error">{error}</p>}
      </div>

      <SidePanel
        dbPath={dbPath}
        user={user}
        graph={graph}
        selectedNode={selectedNode}
        creatingSide={readOnly ? null : creatingSide}
        readOnly={readOnly}
        onClose={handleClosePanel}
        onReload={load}
      />
    </div>
  );
}
