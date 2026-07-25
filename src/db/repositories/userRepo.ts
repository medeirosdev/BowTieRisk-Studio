import { getDb } from '../client';
import { newId } from '../ids';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
}

// Identifica (ou re-identifica) o usuário pelo email — não há autenticação
// (about.md, Seção 9): é atribuição por nome + email, obrigatórios na
// entrada. Email é a chave natural para reconhecer o mesmo usuário.
export async function identifyUser(name: string, email: string): Promise<UserRecord> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = await db.select<UserRow[]>(
    'SELECT id, name, email FROM users WHERE email = $1',
    [email],
  );

  if (existing.length > 0) {
    const user = existing[0];
    await db.execute(
      'UPDATE users SET name = $1, last_seen = $2 WHERE id = $3',
      [name, now, user.id],
    );
    return { id: user.id, name, email };
  }

  const id = newId();
  await db.execute(
    'INSERT INTO users (id, name, email, first_seen, last_seen) VALUES ($1, $2, $3, $4, $4)',
    [id, name, email, now],
  );
  return { id, name, email };
}
