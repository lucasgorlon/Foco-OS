# Foco OS

Painel pessoal de produtividade em português do Brasil. As tarefas têm o Trello como fonte oficial; o Foco OS reúne Hoje, Matriz de Eisenhower, Semana, Pomodoro, Métricas e Configurações. Sem credenciais do Trello, o painel inicia em modo demonstração com tarefas fictícias.

## Executar

O projeto usa os workflows configurados do Replit:

- Web: `pnpm --filter @workspace/foco-os run dev`
- API: `pnpm --filter @workspace/api-server run dev`
- Tipos: `pnpm run typecheck`
- Build geral: `pnpm run build`
- Aplicar schema ao PostgreSQL de desenvolvimento: `pnpm --filter @workspace/db run push`

O banco PostgreSQL do projeto é provisionado pelo Replit. O schema armazena somente sessões de Pomodoro e configurações; tarefas e etiquetas continuam no Trello.

## Secrets

Para conectar o quadro real, adicione estes valores em **Secrets** no Replit:

| Secret | Uso |
| --- | --- |
| `TRELLO_API_KEY` | Autenticar chamadas do backend à API do Trello |
| `TRELLO_TOKEN` | Autorizar o acesso ao quadro |
| `TRELLO_BOARD_ID` | Selecionar o quadro |
| `POS_API_KEY` | Proteger os endpoints usados por automações |

As credenciais do Trello são usadas somente no backend; nunca são enviadas ao navegador. Se as três variáveis do Trello não estiverem presentes, o app usa dados de demonstração. Nesse modo, mudanças nos cards são mantidas apenas enquanto o serviço da API estiver em execução. Sessões reais de Pomodoro e preferências são guardadas no PostgreSQL.

Os endpoints de automação retornam `503` até que `POS_API_KEY` seja configurada. Configure a mesma chave no Make.com, no header `x-api-key`; não a envie em mensagens ou URLs.

## API do Make.com

A documentação legível por navegador está em `/api/docs`.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/resumo-diario` | Prioridades, atrasadas, Entrada, carga e atividade de ontem |
| `GET` | `/api/resumo-semanal` | Conclusões, foco, quadrantes, etiquetas e próxima semana |
| `POST` | `/api/pomodoro` | Registrar uma sessão externa |
| `GET` | `/api/health` | Estado da aplicação e do Trello |

Todos exigem `x-api-key: <POS_API_KEY>`. Para `POST /api/pomodoro`, envie JSON com `durationMinutes`, `startedAt` em ISO 8601 e, opcionalmente, `cardId` e `endedAt`. Também são aceitos `duration`, `start` e `card_id` para compatibilidade com cenários já configurados no Make.com. Se `endedAt` for omitido, será calculado pela duração.

As rotas do app em `/api/cards`, `/api/dashboard`, `/api/metrics`, `/api/settings` e `/api/pomodoro/sessions` são chamadas pelo frontend; as credenciais de automação não fazem parte do bundle do navegador.

## Integração Trello

As listas são resolvidas pelo nome: `Entrada`, prefixos `Q1`–`Q4` e `Concluído`. Leituras do quadro ficam em cache por 60 segundos. A data de conclusão é obtida das ações `updateCard` do Trello. Se um token estiver inválido ou o quadro não puder ser lido, a interface mostra uma mensagem em português em vez de expor credenciais ou apresentar dados como conectados.