# Sincronização multiusuário via SharePoint/OneDrive

Como o BTR Studio permite que várias pessoas trabalhem nos mesmos projetos através de uma pasta sincronizada (SharePoint, OneDrive) sem depender de um servidor central, e sem corromper os bancos SQLite no processo.

## O problema

SQLite é um arquivo único em disco, não um servidor de banco de dados. Isso é ótimo para "um app, um arquivo, zero infraestrutura" — mas quebra de duas formas específicas quando esse arquivo mora numa pasta sincronizada por nuvem:

1. **O cliente de sincronização (SharePoint/OneDrive) opera em nível de arquivo.** Ele percebe que o arquivo mudou e sobe/baixa o arquivo inteiro — não sabe nada sobre transações, páginas ou o formato interno do SQLite. Se ele sincronizar o arquivo no meio de uma escrita, ou se dois computadores escreverem no mesmo arquivo "ao mesmo tempo" (do ponto de vista da nuvem), o resultado pode ser um banco corrompido.
2. **SQLite em modo WAL (Write-Ahead Log) cria arquivos auxiliares** (`.db-wal`, `.db-shm`) e depende de locks de memória compartilhada que assumem um único sistema de arquivos local. Numa pasta sincronizada, isso não faz sentido — os auxiliares sincronizariam separadamente, fora de ordem, e os locks não têm significado nenhum entre duas máquinas diferentes.

A saída simples ("todo mundo edita o arquivo direto de dentro da pasta do SharePoint") é exatamente o cenário que causa corrupção. A estratégia inteira existe para evitar isso.

## O princípio geral

**O arquivo que fica na pasta sincronizada nunca é editado diretamente.** Ele só é tocado em dois momentos, sempre rápidos e atômicos: quando alguém abre o projeto (lê) e quando alguém sincroniza (escreve, de uma vez só, com o arquivo pronto). Toda a edição de verdade — criar uma ameaça, mudar a efetividade de uma barreira, arrastar um nó no canvas — acontece numa **cópia de trabalho local**, fora do alcance do sincronizador.

Isso, combinado com um lock cooperativo simples (um arquivo de texto, não um lock de banco de dados) e algumas redes de segurança, é o suficiente para várias pessoas usarem a mesma pasta compartilhada sem um servidor.

## As peças

### 1. Um arquivo `.db` por projeto

Cada projeto é um banco SQLite independente (`bancos/<slug-do-projeto>.db`). Isso reduz drasticamente a "superfície de conflito": duas pessoas trabalhando em projetos diferentes nunca disputam o mesmo arquivo, mesmo estando na mesma pasta do SharePoint.

### 2. Cópia de trabalho local, fora da pasta sincronizada

Ao abrir um projeto, o app copia `bancos/<projeto>.db` (o **canônico**, dentro da pasta sincronizada) para uma pasta local que o SharePoint/OneDrive nunca vê:

```
%LOCALAPPDATA%\<app>\working\<id-do-projeto>.db
```

É essa cópia — nunca o canônico — que fica aberta e recebe todas as edições enquanto a pessoa trabalha. O arquivo dentro da pasta sincronizada só muda no instante da sincronização, e nesse instante ele é substituído de uma vez (ver item 5), nunca editado incrementalmente.

Ao reabrir um projeto, a cópia de trabalho normalmente é **recriada** a partir do canônico mais recente — garante que ninguém comece a editar em cima de uma versão desatualizada. A exceção é quando a cópia antiga tem edições que nunca foram sincronizadas (o app travou, a luz caiu, o sync falhou e a pessoa saiu mesmo assim). O app percebe isso comparando o **contador de alterações do cabeçalho do SQLite** (bytes 24–27 do arquivo, incrementado a cada transação gravada) com o valor registrado em `working/<id>.json` na última vez que a cópia estava igual ao canônico:

- **O lock é da própria pessoa e o canônico não mudou desde então** → a cópia antiga é reaproveitada como está, e a barra de status avisa que as alterações foram recuperadas e precisam ser sincronizadas.
- **Outra pessoa editou nesse meio-tempo, ou está editando agora** → a cópia antiga é guardada em `backups/nao-sincronizados/<projeto>_<data>.db` antes de ser substituída, e o aviso mostra o caminho. Nada é mesclado automaticamente, mas também nada some.

O contador foi preferido ao `mtime` porque não depende da resolução do relógio nem de o SharePoint/OneDrive preservar datas, e uma cópia byte a byte (o próprio sync) carrega o mesmo valor.

### 3. `journal_mode = DELETE`, nunca WAL

Toda conexão SQLite do app força três PRAGMAs:

```sql
PRAGMA journal_mode = DELETE;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

`DELETE` é o modo de journaling mais simples do SQLite: um único arquivo `.db`, sem os auxiliares `-wal`/`-shm` que o modo WAL (padrão em versões recentes) criaria. Mesmo a cópia de trabalho — que já está fora da pasta sincronizada — usa esse modo, para manter tudo consistente e simples de fazer backup (item 6): sempre um arquivo único, nunca um trio de arquivos que precisam viajar juntos.

### 4. Lock cooperativo com heartbeat

Ao lado de cada `.db` na pasta sincronizada, existe um arquivo `<projeto>.db.lock.json`:

```json
{
  "user_name": "Medeiros",
  "user_email": "medeiros@lnls.br",
  "machine": "medeiros-notebook",
  "acquired_at": "2026-07-31T14:02:10.000Z",
  "heartbeat": "2026-07-31T14:15:40.000Z"
}
```

Enquanto o app está aberto num projeto em modo de edição, ele **rebate** esse arquivo a cada **30 segundos** (`heartbeat`), só atualizando o timestamp — e só se o lock ainda for dele. Se a batida encontrar o lock de outra pessoa (o próprio lock ficou obsoleto e foi reivindicado), ela não sobrescreve: o projeto passa para somente leitura e a pessoa é avisada. Liberar o lock ao fechar segue a mesma regra — só apaga o arquivo se ele ainda for da pessoa. Renomear ou excluir um projeto pela lista também é bloqueado enquanto outra pessoa estiver com ele aberto. Ao abrir um projeto:

- **Sem lock, ou lock da mesma pessoa+máquina** → abre para edição, escreve/atualiza o lock.
- **Lock ativo de outra pessoa** (heartbeat com menos de **3 minutos**) → abre em **somente leitura**, mostrando quem está editando.
- **Lock obsoleto** (heartbeat com mais de 3 minutos — a pessoa fechou o notebook, o app crashou, perdeu a rede) → o app **reivindica o lock automaticamente**, mas exibe um aviso explícito na tela dizendo de quem era o lock obsoleto reivindicado.

Os números (30s / 3min ≈ 6 batidas perdidas) dão margem para o atraso natural de sincronização do SharePoint/OneDrive — que não é instantâneo — sem deixar alguém esperando um lock obsoleto por muito tempo.

Isso é deliberadamente um **lock cooperativo**, não uma trava de verdade: nada impede tecnicamente duas pessoas de editarem ao mesmo tempo se uma delas ignorar o aviso de somente-leitura. A auditoria (item 7) existe em parte para tornar esse cenário investigável depois, caso aconteça.

### 5. Sincronização explícita e atômica

A sincronização acontece quando a pessoa clica em "Sincronizar" na barra de status, ou automaticamente ao fechar o projeto, sair do app ou fechar a janela (o X da janela passa pelo mesmo caminho). Se a sincronização de saída falhar, o app pergunta se a pessoa quer ficar e tentar de novo ou sair mesmo assim — nesse caso as edições ficam na cópia de trabalho e são recuperadas na próxima abertura (item 2). Nesse momento:

1. Confere se o lock ainda é da pessoa. Se outra pessoa o reivindicou (o lock ficou obsoleto porque o notebook dormiu, por exemplo), a sincronização é **recusada**: publicar agora apagaria o trabalho dela. O projeto passa para somente leitura e as edições locais são guardadas em `backups/nao-sincronizados/` na próxima abertura.
2. Fecha a conexão com a cópia de trabalho (nunca copiar um arquivo com conexão aberta).
3. Copia a cópia de trabalho para um arquivo temporário **dentro** da pasta `bancos/` — `<projeto>.db.syncing.tmp` (sem ponto inicial no nome: alguns matchers de escopo do Tauri ignoram arquivos ocultos por padrão, o que já causou uma falha silenciosa de sincronização até ser descoberto).
4. **Renomeia** esse temporário por cima do arquivo canônico (`rename`, não sobrescrita direta) — é uma operação atômica no sistema de arquivos, então o SharePoint/OneDrive nunca vê um estado "pela metade" do arquivo.
5. Grava um backup carimbado com data/hora (item 6).
6. Roda `PRAGMA integrity_check` no arquivo recém-sincronizado (item 7).
7. Reescreve o lock com heartbeat atualizado.
8. Reabre a cópia de trabalho para a pessoa continuar editando.

### 6. Backups automáticos rotacionados

Cada sincronização também grava uma cópia carimbada em `backups/<projeto>_<AAAAMMDD_HHMMSS>.db`. O app mantém as **30 mais recentes** por projeto e apaga as mais antigas automaticamente. É a rede de segurança caso a checagem de integridade falhe ou algo dê errado — sempre dá para voltar a um ponto anterior.

### 7. Checagem de integridade a cada sync

Depois de publicar o arquivo canônico, o app abre uma conexão curta só para rodar `PRAGMA integrity_check` e fecha em seguida. Se o resultado não for `ok`, a sincronização é reportada como bem-sucedida mas com um aviso — a pessoa é instruída a conferir o backup mais recente.

### 8. Detecção de conflito por data de modificação

Ao abrir um projeto, o app guarda a data de modificação (`mtime`) do arquivo canônico. Ao sincronizar, compara com o `mtime` atual: se mudou desde a abertura — por exemplo, alguém sincronizou por fora nesse meio-tempo, ou o SharePoint restaurou uma versão antiga — a sincronização acontece do mesmo jeito (a cópia de trabalho sempre "ganha"), mas a pessoa recebe um aviso de conflito e é orientada a checar o histórico de auditoria.

### 9. Auditoria de tudo

Toda abertura, lock, sincronização, liberação de lock e fechamento gera uma entrada no log de auditoria de cada projeto (`LOCK`, `OPEN`, `SYNC`, `UNLOCK`, `CLOSE`, além de toda mutação de conteúdo). Isso não evita conflitos, mas torna qualquer situação estranha (lock reivindicado, conflito detectado) totalmente rastreável depois — quem fez o quê e quando.

## Fluxo completo

```
Pessoa A                                    Pasta SharePoint/OneDrive              Pessoa B
--------                                    --------------------------             --------
abre projeto
  lê bancos/projeto.db  ←──────────────────  bancos/projeto.db
  lê projeto.db.lock.json (vazio)
  copia canônico → cópia de trabalho local
  escreve lock (A, heartbeat=agora)  ──────→  projeto.db.lock.json
  [edita livremente na cópia local,
   heartbeat a cada 30s]

                                                                                    tenta abrir o mesmo projeto
                                                                                      lê projeto.db.lock.json → A, heartbeat recente
                                                                                      abre em SOMENTE LEITURA
                                                                                      mostra "A está editando"

clica em Sincronizar
  fecha conexão da cópia local
  copia cópia local → temp.syncing.tmp
  rename temp → bancos/projeto.db  ────────→  bancos/projeto.db (atualizado)
  grava backup carimbado
  roda integrity_check
  reabre cópia local

fecha o app
  sincroniza de novo (se houve edição)
  libera o lock  ──────────────────────────→  projeto.db.lock.json (removido)


                                                                                    reabre o projeto
                                                                                      sem lock → abre para edição
```

## O que essa estratégia conscientemente **não** resolve

- **Não há merge automático de conteúdo.** Se duas pessoas efetivamente editarem o mesmo projeto ao mesmo tempo (só possível se alguém ignorar o aviso de somente-leitura), não há reconciliação — a última sincronização sobrescreve. A mitigação é o lock cooperativo evitar que isso aconteça no caminho normal, e a auditoria tornar o que aconteceu investigável.
- **Depende do sincronizador já ter propagado o lock antes da próxima pessoa abrir.** Numa janela muito curta (dois cliques quase simultâneos, rede lenta), existe uma corrida teórica pelo lock. Aceitável dado o caso de uso real: é raro duas pessoas abrirem o mesmo projeto no mesmo segundo.
- **Duas janelas do app no mesmo computador** dividiriam a mesma cópia de trabalho e o mesmo lock. Por isso o app roda em instância única: abrir de novo só traz a janela existente para frente.
- **Não é um banco de dados multiusuário de verdade** — é SQLite + convenção de aplicação. A troca deliberada é zero infraestrutura (nenhum servidor, funciona só com uma pasta compartilhada) em vez de concorrência real.

## Onde cada peça mora no código

| Peça | Arquivo |
| --- | --- |
| Cópia de trabalho, sincronização, lock na abertura/fechamento | `src/db/repositories/projectRepo.ts` |
| Detecção e recuperação de edições não sincronizadas | `src/db/workingCopy.ts` |
| Sincronizar ao fechar a janela, "sair mesmo assim" | `src/app/AppShell.tsx` |
| Lock cooperativo (ler/escrever/heartbeat/obsolescência) | `src/db/lockRepo.ts` |
| Heartbeat automático a cada 30s enquanto edita | `src/features/sync/useHeartbeat.ts` |
| Caminhos (canônico, cópia de trabalho, lock) | `src/db/paths.ts` |
| PRAGMAs de conexão (`journal_mode`, `busy_timeout`) | `src/db/client.ts` |
| Botão de sincronizar, avisos de conflito/lock reivindicado | `src/features/sync/StatusBar.tsx` |
