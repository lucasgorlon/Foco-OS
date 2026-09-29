import { GetCardsResponseItem } from "@workspace/api-zod";
import {
  addCampoGrandeDays,
  campoGrandeDateAtHour,
  campoGrandeDateKey,
  campoGrandeDayStart,
} from "./campo-grande-time";

export type TaskCard = (typeof GetCardsResponseItem)["_output"];

type TrelloList = {
  id: string;
  name: string;
};

type TrelloRawCard = {
  id: string;
  name: string;
  desc?: string;
  due?: string | null;
  idList: string;
  url: string;
  labels?: Array<{ name?: string; color?: string | null }>;
};

type TrelloAction = {
  date: string;
  data?: {
    card?: { id?: string };
    listAfter?: { id?: string; name?: string };
  };
};

type BoardSnapshot = {
  cards: TaskCard[];
  lists: TrelloList[];
};

const DEMO_LABELS = {
  Trabalho: "#7783d6",
  Faculdade: "#65a8bd",
  Pessoal: "#d4a76a",
  Saúde: "#74ad8c",
};

const shiftDays = (date: Date, days: number): Date =>
  campoGrandeDateAtHour(addCampoGrandeDays(date, days), 17);

let demoCardsDateKey: string | null = null;
let demoCards: TaskCard[] = [];

const createDemoCards = (): TaskCard[] => {
  const now = campoGrandeDayStart(new Date());
  return [
  {
    id: "demo-q1-relatorio",
    title: "Concluir revisão do relatório mensal",
    description:
      "Revisar os indicadores finais e encaminhar a versão aprovada para a equipe.",
    listName: "Q1 - Fazer agora",
    due: shiftDays(now, -1),
    labels: [{ name: "Trabalho", color: DEMO_LABELS.Trabalho }],
    url: "https://trello.com/c/demo-relatorio",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-q1-apresentacao",
    title: "Organizar a apresentação do projeto",
    description:
      "Consolidar os principais resultados e preparar os slides para a conversa com o cliente.",
    listName: "Q1 - Fazer agora",
    due: shiftDays(now, 0),
    labels: [{ name: "Trabalho", color: DEMO_LABELS.Trabalho }],
    url: "https://trello.com/c/demo-apresentacao",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-q1-avaliacao",
    title: "Estudar para a avaliação de estatística",
    description:
      "Resolver a lista de exercícios e revisar as anotações das últimas aulas.",
    listName: "Q1 - Fazer agora",
    due: shiftDays(now, 2),
    labels: [{ name: "Faculdade", color: DEMO_LABELS.Faculdade }],
    url: "https://trello.com/c/demo-estatistica",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-q2-leitura",
    title: "Ler o capítulo 4 de estatística",
    description:
      "Separar os conceitos principais para revisar antes da próxima aula.",
    listName: "Q2 - Agendar",
    due: shiftDays(now, 3),
    labels: [{ name: "Faculdade", color: DEMO_LABELS.Faculdade }],
    url: "https://trello.com/c/demo-leitura",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-q2-compromisso",
    title: "Compromisso: conversa de alinhamento",
    description:
      "Encontro rápido para definir próximos passos do projeto.",
    listName: "Q2 - Agendar",
    due: shiftDays(now, 1),
    labels: [{ name: "Trabalho", color: DEMO_LABELS.Trabalho }],
    url: "https://trello.com/c/demo-reuniao",
    completedAt: null,
    isCommitment: true,
  },
  {
    id: "demo-q2-saude",
    title: "Agendar consulta de rotina",
    description: "Escolher um horário livre para a consulta deste mês.",
    listName: "Q2 - Agendar",
    due: shiftDays(now, 6),
    labels: [{ name: "Saúde", color: DEMO_LABELS.Saúde }],
    url: "https://trello.com/c/demo-consulta",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-q3-referencias",
    title: "Enviar referências para o grupo de pesquisa",
    description: "Compartilhar os artigos que podem ajudar na discussão.",
    listName: "Q3 - Delegar",
    due: shiftDays(now, 4),
    labels: [{ name: "Faculdade", color: DEMO_LABELS.Faculdade }],
    url: "https://trello.com/c/demo-referencias",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-q3-mercado",
    title: "Combinar compras da semana",
    description:
      "Alinhar com a família os itens que estão faltando em casa.",
    listName: "Q3 - Delegar",
    due: null,
    labels: [{ name: "Pessoal", color: DEMO_LABELS.Pessoal }],
    url: "https://trello.com/c/demo-compras",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-q4-apps",
    title: "Comparar mais um aplicativo de anotações",
    description: "Ideia opcional para avaliar quando houver tempo.",
    listName: "Q4 - Eliminar",
    due: null,
    labels: [{ name: "Pessoal", color: DEMO_LABELS.Pessoal }],
    url: "https://trello.com/c/demo-anotacoes",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-inbox-mochila",
    title: "Separar material para a aula de amanhã",
    description: "Conferir o caderno e deixar a mochila pronta.",
    listName: "Entrada",
    due: shiftDays(now, 0),
    labels: [{ name: "Faculdade", color: DEMO_LABELS.Faculdade }],
    url: "https://trello.com/c/demo-mochila",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-inbox-caminhada",
    title: "Fazer uma caminhada curta no fim do dia",
    description: "Ideia para encaixar um pouco de movimento na rotina.",
    listName: "Entrada",
    due: null,
    labels: [{ name: "Saúde", color: DEMO_LABELS.Saúde }],
    url: "https://trello.com/c/demo-caminhada",
    completedAt: null,
    isCommitment: false,
  },
  {
    id: "demo-done-planejamento",
    title: "Revisar o planejamento da semana",
    description: "Revisão concluída e prioridades organizadas.",
    listName: "Concluído",
    due: shiftDays(now, -2),
    labels: [{ name: "Pessoal", color: DEMO_LABELS.Pessoal }],
    url: "https://trello.com/c/demo-planejamento",
    completedAt: shiftDays(now, 0),
    isCommitment: false,
  },
  {
    id: "demo-done-aula",
    title: "Enviar atividade da última aula",
    description: "Atividade enviada para a plataforma da faculdade.",
    listName: "Concluído",
    due: shiftDays(now, -1),
    labels: [{ name: "Faculdade", color: DEMO_LABELS.Faculdade }],
    url: "https://trello.com/c/demo-atividade",
    completedAt: shiftDays(now, -1),
    isCommitment: false,
  },
  ];
};

const getDemoCards = (): TaskCard[] => {
  const todayKey = campoGrandeDateKey(new Date());
  if (demoCardsDateKey !== todayKey) {
    demoCardsDateKey = todayKey;
    demoCards = createDemoCards();
  }
  return demoCards;
};

let cachedSnapshot: { expiresAt: number; value: BoardSnapshot } | null = null;
let inFlightSnapshot: Promise<BoardSnapshot> | null = null;

const boardConfig = () => ({
  apiKey: process.env.TRELLO_API_KEY,
  token: process.env.TRELLO_TOKEN,
  boardId: process.env.TRELLO_BOARD_ID,
});

export const isTrelloConfigured = (): boolean => {
  const { apiKey, token, boardId } = boardConfig();
  return Boolean(apiKey && token && boardId);
};

const canonicalListName = (name: string): string => {
  const normalized = name.trim().toLocaleLowerCase("pt-BR");
  if (normalized === "entrada") return "Entrada";
  if (normalized === "concluído" || normalized === "concluido")
    return "Concluído";
  const prefix = normalized.match(/^q([1-4])(?:\b|\s|-)/)?.[1];
  if (prefix === "1") return "Q1 - Fazer agora";
  if (prefix === "2") return "Q2 - Agendar";
  if (prefix === "3") return "Q3 - Delegar";
  if (prefix === "4") return "Q4 - Eliminar";
  return name;
};

const normalizeListName = (name: string): string =>
  canonicalListName(name).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const fetchTrello = async <T>(
  path: string,
  method: "GET" | "PUT" = "GET",
  params: Record<string, string> = {},
): Promise<T> => {
  const { apiKey, token } = boardConfig();
  if (!apiKey || !token) {
    throw new Error("A conexão com o Trello não está configurada.");
  }

  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao Trello. Verifique sua conexão e tente novamente.",
    );
  }

  if (!response.ok) {
    throw new Error(
      "O Trello recusou a solicitação. Confira as credenciais e permissões configuradas.",
    );
  }

  return (await response.json()) as T;
};

const readBoardSnapshot = async (): Promise<BoardSnapshot> => {
  const { boardId } = boardConfig();
  if (!boardId) throw new Error("O quadro do Trello não está configurado.");

  const [lists, rawCards, actions] = await Promise.all([
    fetchTrello<TrelloList[]>(
      `/boards/${encodeURIComponent(boardId)}/lists`,
      "GET",
      { filter: "open", fields: "name" },
    ),
    fetchTrello<TrelloRawCard[]>(
      `/boards/${encodeURIComponent(boardId)}/cards`,
      "GET",
      { filter: "open", fields: "name,desc,due,idList,url,labels" },
    ),
    fetchTrello<TrelloAction[]>(
      `/boards/${encodeURIComponent(boardId)}/actions`,
      "GET",
      { filter: "updateCard", limit: "1000", fields: "date,data,type" },
    ),
  ]);

  const completedListIds = new Set(
    lists
      .filter((list) => normalizeListName(list.name) === "concluido")
      .map((list) => list.id),
  );
  const completedAtByCard = new Map<string, Date>();
  for (const action of actions) {
    const cardId = action.data?.card?.id;
    const listAfter = action.data?.listAfter;
    if (
      cardId &&
      listAfter &&
      (Boolean(listAfter.id && completedListIds.has(listAfter.id)) ||
        normalizeListName(listAfter.name ?? "") === "concluido") &&
      !completedAtByCard.has(cardId)
    ) {
      const date = new Date(action.date);
      if (!Number.isNaN(date.getTime())) completedAtByCard.set(cardId, date);
    }
  }

  const listNames = new Map(
    lists.map((list) => [list.id, canonicalListName(list.name)]),
  );

  const cards = rawCards.map((card): TaskCard => {
    const listName = listNames.get(card.idList) ?? "Entrada";
    const labels = (card.labels ?? [])
      .filter((label) => label.name)
      .map((label) => ({
        name: label.name ?? "",
        color: label.color ?? "#64748b",
      }));
    const commitmentLabel = labels.some((label) =>
      label.name.toLocaleLowerCase("pt-BR").includes("compromisso"),
    );

    return {
      id: card.id,
      title: card.name,
      description: card.desc ?? "",
      listName,
      due: card.due ? new Date(card.due) : null,
      labels,
      url: card.url,
      completedAt:
        listName === "Concluído" ? (completedAtByCard.get(card.id) ?? null) : null,
      isCommitment:
        card.name.toLocaleLowerCase("pt-BR").startsWith("compromisso:") ||
        commitmentLabel,
    };
  });

  return { cards, lists };
};

export const getBoardSnapshot = async (): Promise<BoardSnapshot> => {
  if (!isTrelloConfigured()) return { cards: getDemoCards(), lists: [] };
  if (cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
    return cachedSnapshot.value;
  }
  if (inFlightSnapshot) return inFlightSnapshot;

  inFlightSnapshot = readBoardSnapshot();
  try {
    const value = await inFlightSnapshot;
    cachedSnapshot = { value, expiresAt: Date.now() + 60_000 };
    return value;
  } finally {
    inFlightSnapshot = null;
  }
};

export const getConnectionStatus = async (): Promise<{
  connected: boolean;
  mode: "trello" | "demo";
  message: string;
}> => {
  if (!isTrelloConfigured()) {
    return {
      connected: false,
      mode: "demo",
      message: "Modo demonstração: configure os Secrets para conectar o Trello.",
    };
  }
  try {
    await getBoardSnapshot();
    return {
      connected: true,
      mode: "trello",
      message: "Conectado ao Trello.",
    };
  } catch {
    return {
      connected: false,
      mode: "trello",
      message:
        "Não foi possível acessar o Trello. Verifique as credenciais e as permissões do quadro.",
    };
  }
};

export const moveBoardCard = async (
  cardId: string,
  listName: string,
): Promise<TaskCard | null> => {
  const snapshot = await getBoardSnapshot();
  const current = snapshot.cards.find((card) => card.id === cardId);
  if (!current) return null;

  if (!isTrelloConfigured()) {
    const demoCard = getDemoCards().find((card) => card.id === cardId);
    if (!demoCard) return null;
    demoCard.listName = listName;
    demoCard.completedAt = listName === "Concluído" ? new Date() : null;
    return { ...demoCard };
  }

  const targetList = snapshot.lists.find(
    (list) => normalizeListName(list.name) === normalizeListName(listName),
  );
  if (!targetList) {
    throw new Error(
      `A lista "${listName}" não foi encontrada no quadro do Trello.`,
    );
  }

  await fetchTrello<unknown>(
    `/cards/${encodeURIComponent(cardId)}`,
    "PUT",
    { idList: targetList.id },
  );
  cachedSnapshot = null;

  return {
    ...current,
    listName: canonicalListName(targetList.name),
    completedAt:
      canonicalListName(targetList.name) === "Concluído" ? new Date() : null,
  };
};

export const isCompleted = (card: TaskCard): boolean =>
  normalizeListName(card.listName) === "concluido";

export const isInbox = (card: TaskCard): boolean =>
  normalizeListName(card.listName) === "entrada";

export const isQuadrant = (card: TaskCard): boolean =>
  /^Q[1-4]\b/.test(card.listName);

export const demoLabels = DEMO_LABELS;