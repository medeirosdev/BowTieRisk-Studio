import type Database from '@tauri-apps/plugin-sql';
import type { CurrentUser } from '../../store/currentUserStore';
import type { Category, CategoryKind } from '../../types/domain';
import { writeAudit } from '../audit';
import { getDbAt } from '../client';
import { newId } from '../ids';

const DEFAULT_CATEGORIES: readonly { kind: CategoryKind; label: string; color: string }[] = [
  { kind: 'threat', label: 'Pessoas', color: 'blue' },
  { kind: 'threat', label: 'Resíduos', color: 'green' },
  { kind: 'threat', label: 'Equipamento', color: 'orange' },
  { kind: 'consequence', label: 'Pessoas', color: 'blue' },
  { kind: 'consequence', label: 'Meio ambiente', color: 'green' },
  { kind: 'consequence', label: 'Patrimônio', color: 'purple' },
];

// Ponto de partida de todo projeto (novo ou migrado) — personalizável depois
// na tela de Configurações do projeto.
export async function seedDefaultCategories(db: Database, user: CurrentUser): Promise<void> {
  const now = new Date().toISOString();
  const orderByKind: Record<CategoryKind, number> = { threat: 0, consequence: 0 };
  for (const { kind, label, color } of DEFAULT_CATEGORIES) {
    await db.execute(
      'INSERT INTO categories (id, kind, label, color, order_index, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [newId(), kind, label, color, orderByKind[kind]++, user.name, now],
    );
  }
}

export async function listCategories(dbPath: string): Promise<Category[]> {
  const db = await getDbAt(dbPath);
  return db.select<Category[]>('SELECT id, kind, label, color, order_index FROM categories ORDER BY kind, order_index');
}

export async function createCategory(dbPath: string, kind: CategoryKind, label: string, color: string, user: CurrentUser): Promise<Category> {
  const db = await getDbAt(dbPath);
  const [{ nextIndex }] = await db.select<{ nextIndex: number }[]>(
    'SELECT COALESCE(MAX(order_index) + 1, 0) as nextIndex FROM categories WHERE kind = $1',
    [kind],
  );
  const category: Category = { id: newId(), kind, label, color, order_index: nextIndex };
  await db.execute(
    'INSERT INTO categories (id, kind, label, color, order_index, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [category.id, kind, label, color, nextIndex, user.name, new Date().toISOString()],
  );
  await writeAudit(db, user, { action: 'CREATE', entityType: 'category', entityId: category.id, entityLabel: label, after: category });
  return category;
}

export async function updateCategoryColor(dbPath: string, category: Category, color: string, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  await db.execute('UPDATE categories SET color = $1 WHERE id = $2', [color, category.id]);
  await writeAudit(db, user, {
    action: 'UPDATE',
    entityType: 'category',
    entityId: category.id,
    entityLabel: category.label,
    before: category,
    after: { ...category, color },
  });
}

// ON DELETE SET NULL em threats/consequences.category_id limpa a referência
// de quem usava essa categoria — elas continuam existindo, só ficam sem.
// Ameaças/consequências só aceitam categorias da própria lista (as duas são
// separadas — about.md, Seção 14). O schema não tem como expressar isso numa
// FK, então a checagem fica aqui, antes de gravar.
export async function assertCategoryKind(db: Database, categoryId: string | null, kind: CategoryKind): Promise<void> {
  if (!categoryId) return;
  const rows = await db.select<{ kind: string }[]>('SELECT kind FROM categories WHERE id = $1', [categoryId]);
  if (rows.length === 0) throw new Error('Categoria não encontrada (pode ter sido excluída).');
  if (rows[0].kind !== kind) throw new Error('Categoria de outra lista.');
}

export async function deleteCategory(dbPath: string, category: Category, user: CurrentUser): Promise<void> {
  const db = await getDbAt(dbPath);
  // Os itens perdem a categoria via ON DELETE SET NULL, que não passa pelo
  // audit_log — por isso a lista de afetados vai no próprio registro da
  // exclusão, pra dar pra reconstruir o antes.
  const table = category.kind === 'threat' ? 'threats' : 'consequences';
  const affected = await db.select<{ id: string; label: string }[]>(`SELECT id, label FROM ${table} WHERE category_id = $1`, [category.id]);
  await db.execute('DELETE FROM categories WHERE id = $1', [category.id]);
  await writeAudit(db, user, {
    action: 'DELETE',
    entityType: 'category',
    entityId: category.id,
    entityLabel: category.label,
    before: { ...category, uncategorized_items: affected },
  });
}
