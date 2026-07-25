import { ulid } from 'ulid';

// Gerador de ID para todas as PKs do domínio (about.md, Seção 5.2/13).
// ULID em vez de autoincrement: evita colisão ao mesclar bancos de projetos
// diferentes (ver Seção 6.4) e é ordenável por tempo de criação.
export function newId(): string {
  return ulid();
}
