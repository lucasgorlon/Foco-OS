import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import PasswordGate, { LogoutButton } from '@/components/password-gate';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Archive, ArrowDown, ArrowRight, BarChart3, CalendarDays,
  Check, CheckCircle2, ChevronLeft, ChevronRight, Circle,
  Clock3, ExternalLink, GripVertical, Inbox, LayoutGrid,
  Link2, Moon, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Play, RotateCcw, Search, Settings, SlidersHorizontal,
  Sun, Target, Timer, TrendingDown, X
} from 'lucide-react';
import {
  useCreatePomodoroSession,
  useGetCards, useGetConnection, useGetDailySummary, useGetMetrics,
  useGetSettings, useGetWeeklySummary,
  useMoveCard, useUpdateSettings
} from '@workspace/api-client-react';
import type { MetricsSummary, TaskCard, WeeklySummary } from '@workspace/api-client-react';
import { Route, Switch, Link, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const CAMPO_GRANDE_TIME_ZONE = 'America/Campo_Grande';
const dateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPO_GRANDE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const CampoGrandeTodayContext = createContext(getCampoGrandeDateKey(new Date()));

function getCampoGrandeDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(dateKeyFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function asDisplayDate(value: string | Date) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00.000Z`);
  }
  return value instanceof Date ? value : new Date(value);
}

function asCalendarDate(value: string | Date) {
  const dateOnlyString =
    typeof value === 'string'
      ? /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0+)?(?:Z|\+00:00))?$/.exec(value)?.[1]
      : undefined;
  const dateOnly =
    dateOnlyString ??
    (value instanceof Date &&
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
      ? value.toISOString().slice(0, 10)
      : getCampoGrandeDateKey(value));
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

function useCampoGrandeToday() {
  return useContext(CampoGrandeTodayContext);
}

function CampoGrandeTodayProvider({ children }: { children: React.ReactNode }) {
  const [today, setToday] = useState(() => getCampoGrandeDateKey(new Date()));
  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentDay = getCampoGrandeDateKey(new Date());
      setToday((previous) => previous === currentDay ? previous : currentDay);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);
  return <CampoGrandeTodayContext.Provider value={today}>{children}</CampoGrandeTodayContext.Provider>;
}

type IconType = typeof Target;
type Quadrant = 'Q1 - Fazer agora' | 'Q2 - Agendar' | 'Q3 - Delegar' | 'Q4 - Eliminar';
const quadrants: { name: Quadrant; short: string; tone: string; border: string; hint: string }[] = [
  { name: 'Q1 - Fazer agora', short: 'Fazer agora', tone: 'bg-red-500/10', border: 'border-red-400/30', hint: 'Urgente e importante' },
  { name: 'Q2 - Agendar', short: 'Agendar', tone: 'bg-blue-500/10', border: 'border-blue-400/30', hint: 'Importante, sem urgência' },
  { name: 'Q3 - Delegar', short: 'Delegar', tone: 'bg-amber-500/10', border: 'border-amber-400/30', hint: 'Urgente, pouca importância' },
  { name: 'Q4 - Eliminar', short: 'Eliminar', tone: 'bg-slate-500/10', border: 'border-slate-400/30', hint: 'Nem urgente, nem importante' },
];

const navItems: { href: string; label: string; icon: IconType }[] = [
  { href: '/', label: 'Hoje', icon: Target },
  { href: '/matriz', label: 'Matriz', icon: LayoutGrid },
  { href: '/semana', label: 'Semana', icon: CalendarDays },
  { href: '/pomodoro', label: 'Pomodoro', icon: Timer },
  { href: '/metricas', label: 'Métricas', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

function cn(...classes: (string | false | null | undefined)[]) { return classes.filter(Boolean).join(' '); }
function formatDate(value?: string | Date | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: CAMPO_GRANDE_TIME_ZONE, day: '2-digit', month: 'short' }).format(asDisplayDate(value));
}
function formatCalendarDate(value?: string | Date | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: CAMPO_GRANDE_TIME_ZONE, day: '2-digit', month: 'short' }).format(asCalendarDate(value));
}
function formatLongDate(value?: string | Date | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: CAMPO_GRANDE_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(asDisplayDate(value));
}
function formatWeekday(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: CAMPO_GRANDE_TIME_ZONE, weekday: 'short' }).format(asCalendarDate(value));
}
function formatDayOfMonth(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: CAMPO_GRANDE_TIME_ZONE, day: 'numeric' }).format(asCalendarDate(value));
}

function useDailySummary() {
  const todayKey = useCampoGrandeToday();
  const query = useGetDailySummary();
  useEffect(() => {
    if (query.data?.date && getCampoGrandeDateKey(query.data.date) !== todayKey) {
      void query.refetch();
    }
  }, [todayKey, query.data?.date, query.refetch]);
  return { ...query, todayKey };
}

function useRefetchOnCampoGrandeDayChange(refetch: () => Promise<unknown>) {
  const todayKey = useCampoGrandeToday();
  const previousDay = useRef(todayKey);
  useEffect(() => {
    if (previousDay.current !== todayKey) {
      previousDay.current = todayKey;
      void refetch();
    }
  }, [todayKey, refetch]);
}
function formatPercent(value?: number) {
  const normalized = value ?? 0;
  return `${Math.round(normalized <= 1 ? normalized * 100 : normalized)}%`;
}
function listToQuadrant(listName: string): Quadrant | null {
  return quadrants.find((item) => item.name === listName)?.name ?? null;
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return <div className="space-y-3" data-testid="loading-skeleton">
    {Array.from({ length: count }).map((_, index) => <div key={index} className="foco-card p-4">
      <div className="skeleton h-3 w-1/3" /><div className="skeleton mt-3 h-4 w-4/5" /><div className="skeleton mt-2 h-3 w-1/2" />
    </div>)}
  </div>;
}

function QueryMessage({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  if (!error) return <div className="foco-card flex min-h-40 flex-col items-center justify-center p-8 text-center" data-testid="empty-state">
    <Inbox className="mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">Nada por aqui ainda</p>
    <p className="mt-1 text-sm text-muted-foreground">Quando o Trello enviar dados, eles aparecem nesta área.</p>
  </div>;
  return <div className="foco-card flex min-h-40 flex-col items-center justify-center p-8 text-center" data-testid="error-state">
    <Archive className="mb-3 h-7 w-7 text-destructive" /><p className="font-medium">Não foi possível carregar</p>
    <p className="mt-1 text-sm text-muted-foreground">Verifique a conexão com o Trello e tente novamente.</p>
    <button data-testid="button-retry" onClick={onRetry} className="pressable mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Tentar novamente</button>
  </div>;
}

function AppShell({ children, collapsed, setCollapsed, theme, onToggleTheme }: { children: React.ReactNode; collapsed: boolean; setCollapsed: (value: boolean) => void; theme: 'dark' | 'light'; onToggleTheme: () => void }) {
  const [location] = useLocation();
  return <div className="foco-shell flex text-sm">
    <aside className={cn('hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex', collapsed ? 'w-[76px]' : 'w-[232px]')} data-testid="sidebar">
      <div className={cn('flex h-20 items-center border-b border-sidebar-border px-5', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sidebar-primary text-sidebar-primary-foreground"><Target className="h-5 w-5" /></div>
        {!collapsed && <div className="nav-label"><p className="font-extrabold tracking-[-0.03em] text-sidebar-accent-foreground">Foco OS</p><p className="mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">clareza diária</p></div>}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Navegação principal">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={cn('pressable flex items-center gap-3 rounded-[10px] px-3 py-3 text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground', location === href && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm')}>
          <Icon className="h-[18px] w-[18px] shrink-0" /><span className={cn('nav-label', collapsed && 'w-0 opacity-0')}>{label}</span>{!collapsed && location === href && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
        </Link>)}
      </nav>
      <div className={cn('border-t border-sidebar-border p-3', collapsed ? 'flex justify-center' : '')}>
        <button data-testid="button-toggle-theme" onClick={onToggleTheme} className={cn('pressable flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground', collapsed && 'w-auto')} aria-label="Alternar tema">
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}<span className={cn('nav-label', collapsed && 'w-0 opacity-0')}>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
        <button data-testid="button-collapse-sidebar" onClick={() => setCollapsed(!collapsed)} className="pressable mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" aria-label="Recolher navegação">
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}<span className={cn('nav-label', collapsed && 'w-0 opacity-0')}>Recolher menu</span>
        </button>
        <LogoutButton collapsed={collapsed} className="mt-1" />
      </div>
    </aside>
    <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[68px] items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur-md md:hidden" aria-label="Navegação móvel">
      {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-mobile-${label.toLowerCase()}`} className={cn('flex min-w-[58px] flex-col items-center gap-1 rounded-lg py-2 text-[10px] text-muted-foreground', location === href && 'text-primary')}>
        <Icon className="h-[18px] w-[18px]" /><span>{label}</span>
      </Link>)}
      <Link href="/configuracoes" data-testid="link-mobile-configuracoes" className={cn('flex min-w-[58px] flex-col items-center gap-1 rounded-lg py-2 text-[10px] text-muted-foreground', location === '/configuracoes' && 'text-primary')}><Settings className="h-[18px] w-[18px]" /><span>Config.</span></Link>
    </nav>
  </div>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><p className="mono mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">{eyebrow}</p><h1 className="text-3xl font-extrabold tracking-[-0.045em] sm:text-[38px]">{title}</h1>{description && <p className="mt-2 max-w-xl text-muted-foreground">{description}</p>}</div>
    {action}
  </header>;
}

function CardTile({ card, onOpen, compact = false }: { card: TaskCard; onOpen: (card: TaskCard) => void; compact?: boolean }) {
  const todayKey = useCampoGrandeToday();
  return <button data-testid={`card-task-${card.id}`} onClick={() => onOpen(card)} className={cn('pressable group w-full rounded-[10px] border border-border bg-background/50 p-3 text-left hover:border-primary/50 hover:bg-accent/40', compact && 'p-2.5')}>
    <div className="flex items-start gap-2"><span className="mt-0.5 text-muted-foreground/60"><GripVertical className="h-3.5 w-3.5" /></span><span className={cn('font-medium leading-snug', card.completedAt && 'text-muted-foreground line-through')}>{card.title}</span><MoreHorizontal className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" /></div>
    {!compact && <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
      {card.due && <span className={cn('inline-flex items-center gap-1', getCampoGrandeDateKey(card.due) < todayKey && !card.completedAt && 'text-destructive')}><Clock3 className="h-3 w-3" />{formatDate(card.due)}</span>}
      {card.isCommitment && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">compromisso</span>}
      {card.labels?.slice(0, 2).map((label) => <span key={label.name} className="rounded px-1.5 py-0.5" style={{ backgroundColor: `${label.color}25`, color: label.color }}>{label.name}</span>)}
    </div>}
  </button>;
}

function CardDrawer({ card, onClose, onStart }: { card: TaskCard | null; onClose: () => void; onStart?: (card: TaskCard) => void }) {
  if (!card) return null;
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]" onClick={onClose} data-testid="card-drawer">
    <aside onClick={(event) => event.stopPropagation()} className="page-enter h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6 shadow-2xl">
      <div className="flex items-center justify-between"><span className="mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Detalhes do card</span><button data-testid="button-close-card" onClick={onClose} className="pressable rounded-lg p-2 text-muted-foreground hover:bg-accent"><X className="h-5 w-5" /></button></div>
      <div className="mt-10"><div className="mb-4 flex items-center gap-2"><span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{card.listName}</span>{card.isCommitment && <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">compromisso</span>}</div>
        <h2 className="text-2xl font-bold tracking-[-.03em]">{card.title}</h2><p className="mt-4 whitespace-pre-wrap leading-7 text-muted-foreground">{card.description || 'Este card não possui descrição.'}</p>
        <div className="mt-8 space-y-4 border-t border-border pt-5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Prazo</span><span className="font-medium">{card.due ? formatLongDate(card.due) : 'Sem prazo'}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{card.completedAt ? 'Concluído' : 'Em aberto'}</span></div></div>
        <div className="mt-8 flex gap-2"><a data-testid="link-open-trello" href={card.url} target="_blank" rel="noreferrer" className="pressable flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-semibold hover:bg-accent"><ExternalLink className="h-4 w-4" />Abrir no Trello</a>{onStart && <button data-testid="button-start-card" onClick={() => onStart(card)} className="pressable flex items-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"><Play className="h-4 w-4" />Focar</button>}</div>
      </div>
    </aside>
  </div>;
}

function TodayPage() {
  const daily = useDailySummary();
  const cardsQuery = useGetCards({ includeCompleted: false });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TaskCard | null>(null);
  const priorities = daily.data?.priorities ?? [];
  const overdue = daily.data?.overdue ?? [];
  const filtered = useMemo(() => priorities.filter((card) => card.title.toLowerCase().includes(search.toLowerCase())), [priorities, search]);
  const workload = daily.data?.workload;
  return <div className="page-enter mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
    <PageHeader eyebrow={formatLongDate(daily.todayKey)} title="Hoje" description="Uma coisa importante de cada vez." action={<div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />Trello conectado</div>} />
    {daily.isLoading ? <SkeletonRows count={4} /> : daily.isError ? <QueryMessage error onRetry={() => daily.refetch()} /> : <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Prioridades', value: priorities.length, icon: Target, color: 'text-primary' },
          { label: 'Em atraso', value: overdue.length, icon: TrendingDown, color: overdue.length ? 'text-destructive' : 'text-muted-foreground' },
          { label: 'Foco hoje', value: `${daily.data?.pomodorosToday ?? 0}`, suffix: ' ciclos', icon: Timer, color: 'text-amber-500' },
          { label: 'Concluídas', value: daily.data?.completedToday ?? 0, icon: CheckCircle2, color: 'text-emerald-500' },
        ].map(({ label, value, suffix, icon: Icon, color }) => <div key={label} className="foco-card p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className={cn('h-4 w-4', color)} /></div><div className="mt-4 text-2xl font-bold tracking-[-.04em] sm:text-3xl" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}<small className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</small></div></div>)}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="foco-card p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Prioridades do dia</h2><p className="mt-1 text-xs text-muted-foreground">{priorities.length ? 'O que merece sua atenção agora' : 'Sua lista está limpa'}</p></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-search-today" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cards" className="h-9 w-44 rounded-lg border border-input bg-background pl-9 pr-3 text-xs outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring-2" /></div></div>
          {filtered.length ? <div className="space-y-2">{filtered.map((card) => <CardTile key={card.id} card={card} onOpen={setSelected} />)}</div> : <QueryMessage />}
        </section>
        <div className="space-y-5"><section className="foco-card overflow-hidden"><div className="border-b border-border p-5"><div className="flex items-center justify-between"><h2 className="font-bold">Carga de trabalho</h2><span className={cn('rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider', workload?.level === 'red' ? 'bg-red-500/10 text-red-500' : workload?.level === 'yellow' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600')}>{workload?.level === 'red' ? 'Atenção' : workload?.level === 'yellow' ? 'Equilibrar' : 'Leve'}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{workload?.message || 'Você está no ritmo certo para o dia.'}</p></div><div className="grid grid-cols-3 divide-x divide-border p-4 text-center"><div><b className="text-xl">{workload?.q1Count ?? 0}</b><p className="mt-1 text-[10px] text-muted-foreground">Q1</p></div><div><b className="text-xl">{workload?.overdueCount ?? 0}</b><p className="mt-1 text-[10px] text-muted-foreground">atrasadas</p></div><div><b className="text-xl">{workload?.pomodorosCount ?? 0}</b><p className="mt-1 text-[10px] text-muted-foreground">ciclos</p></div></div></section>
          <section className="foco-card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Caixa de entrada</h2><Inbox className="h-4 w-4 text-muted-foreground" /></div><p className="text-4xl font-bold tracking-[-.05em]">{daily.data?.inboxCount ?? 0}</p><p className="mt-1 text-sm text-muted-foreground">cards esperando triagem</p><Link href="/matriz" data-testid="link-inbox-matriz" className="mt-5 flex items-center gap-1 text-xs font-semibold text-primary">Organizar na matriz <ArrowRight className="h-3.5 w-3.5" /></Link></section>
        </div>
      </div>
      {overdue.length > 0 && <section className="foco-card border-destructive/30 p-5"><div className="mb-4 flex items-center gap-2"><Clock3 className="h-4 w-4 text-destructive" /><h2 className="font-bold">Precisa de decisão</h2><span className="text-xs text-muted-foreground">· {overdue.length} cards em atraso</span></div><div className="grid gap-2 md:grid-cols-2">{overdue.slice(0, 4).map((card) => <CardTile key={card.id} card={card} onOpen={setSelected} compact />)}</div></section>}
    </div>}
    <CardDrawer card={selected} onClose={() => setSelected(null)} />
    <div className="sr-only">{cardsQuery.data?.length ?? 0} cards sincronizados</div>
  </div>;
}

function MatrixPage() {
  const cardsQuery = useGetCards({ includeCompleted: false });
  const mover = useMoveCard();
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [selected, setSelected] = useState<TaskCard | null>(null);
  useEffect(() => { if (cardsQuery.data) setCards(cardsQuery.data); }, [cardsQuery.data]);
  const grouped = useMemo(() => Object.fromEntries(quadrants.map((q) => [q.name, cards.filter((card) => card.listName === q.name)])) as Record<Quadrant, TaskCard[]>, [cards]);
  function move(card: TaskCard, listName: Quadrant) {
    if (card.listName === listName) return;
    const previous = cards;
    setCards((current) => current.map((item) => item.id === card.id ? { ...item, listName } : item));
    mover.mutate({ cardId: card.id, data: { listName } }, { onError: () => setCards(previous) });
  }
  return <div className="page-enter mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
    <PageHeader eyebrow="triagem visual" title="Matriz de Eisenhower" description="Arraste os cards para decidir onde sua atenção deve estar." action={<div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />{cards.length} cards abertos</div>} />
    {cardsQuery.isLoading ? <div className="grid gap-4 md:grid-cols-2"><SkeletonRows count={2} /><SkeletonRows count={2} /></div> : cardsQuery.isError ? <QueryMessage error onRetry={() => cardsQuery.refetch()} /> : <div className="grid gap-4 md:grid-cols-2">{quadrants.map((quadrant) => <section key={quadrant.name} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const cardId = event.dataTransfer.getData('cardId'); const card = cards.find((item) => item.id === cardId); if (card) move(card, quadrant.name); }} className={cn('min-h-[260px] rounded-[12px] border p-4', quadrant.tone, quadrant.border)} data-testid={`quadrant-${quadrant.short.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-4 flex items-start justify-between"><div><h2 className="font-bold">{quadrant.short}</h2><p className="mt-1 text-xs text-muted-foreground">{quadrant.hint}</p></div><span className="mono rounded-md bg-background/60 px-2 py-1 text-xs text-muted-foreground">{grouped[quadrant.name]?.length ?? 0}</span></div><div className="space-y-2">{(grouped[quadrant.name] ?? []).map((card) => <div key={card.id} draggable onDragStart={(event) => event.dataTransfer.setData('cardId', card.id)}><CardTile card={card} onOpen={setSelected} compact /></div>)}{!grouped[quadrant.name]?.length && <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-current/15 text-center text-xs text-muted-foreground">Solte cards aqui</div>}</div></section>)}</div>}
    <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><GripVertical className="h-3.5 w-3.5" />Arraste um card entre quadrantes para atualizar sua lista no Trello.</p>
    <CardDrawer card={selected} onClose={() => setSelected(null)} />
  </div>;
}

function WeekPage() {
  const [offset, setOffset] = useState(0);
  const weekly = useGetWeeklySummary({ weekOffset: offset });
  useRefetchOnCampoGrandeDayChange(weekly.refetch);
  const [selected, setSelected] = useState<TaskCard | null>(null);
  const data = weekly.data as WeeklySummary | undefined;
  return <div className="page-enter mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
    <PageHeader eyebrow="ritmo da semana" title="Planejamento semanal" description="Veja o que está marcado, encontre espaços e proteja o essencial." action={<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1"><button data-testid="button-previous-week" onClick={() => setOffset((value) => value - 1)} className="pressable rounded-md p-2 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button><button data-testid="button-current-week" onClick={() => setOffset(0)} className="pressable rounded-md px-3 py-2 text-xs font-semibold hover:bg-accent">Esta semana</button><button data-testid="button-next-week" onClick={() => setOffset((value) => value + 1)} className="pressable rounded-md p-2 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button></div>} />
    {weekly.isLoading ? <SkeletonRows count={5} /> : weekly.isError ? <QueryMessage error onRetry={() => weekly.refetch()} /> : <div className="space-y-5"><section className="foco-card overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><p className="text-sm font-semibold">{formatCalendarDate(data?.weekStart)} — {formatCalendarDate(data?.weekEnd)}</p><span className="text-xs text-muted-foreground">{offset === 0 ? 'semana atual' : `${Math.abs(offset)} ${Math.abs(offset) === 1 ? 'semana' : 'semanas'} ${offset < 0 ? 'atrás' : 'à frente'}`}</span></div><div className="grid grid-cols-1 divide-y divide-border md:grid-cols-7 md:divide-x md:divide-y-0">{data?.days?.map((day, index) => <div key={day.date} className="min-h-44 p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{formatWeekday(day.date)}</p><p className={cn('mt-1 text-lg font-bold', index === 0 && offset === 0 && 'text-primary')}>{formatDayOfMonth(day.date)}</p></div><span className="mono text-[10px] text-muted-foreground">{day.cards.length}</span></div><div className="space-y-2">{day.cards.slice(0, 4).map((card) => <CardTile key={card.id} card={card} onOpen={setSelected} compact />)}{day.cards.length > 4 && <p className="text-center text-[11px] text-muted-foreground">+{day.cards.length - 4} cards</p>}</div></div>)}</div></section><section className="foco-card p-5"><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h2 className="font-bold">Sem data</h2><span className="text-xs text-muted-foreground">· {data?.withoutDate?.length ?? 0} cards</span></div>{data?.withoutDate?.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.withoutDate.map((card) => <CardTile key={card.id} card={card} onOpen={setSelected} compact />)}</div> : <p className="py-6 text-sm text-muted-foreground">Não há cards sem data na sua caixa de entrada.</p>}</section></div>}
    <CardDrawer card={selected} onClose={() => setSelected(null)} />
  </div>;
}

function PomodoroPage() {
  const settingsQuery = useGetSettings();
  const cardsQuery = useGetCards({ includeCompleted: false });
  const daily = useDailySummary();
  const sessionMutation = useCreatePomodoroSession();
  const [selectedCard, setSelectedCard] = useState<TaskCard | null>(null);
  const [cardSearch, setCardSearch] = useState('');
  const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const minutes = mode === 'focus' ? settingsQuery.data?.focusMinutes ?? 25 : mode === 'short' ? settingsQuery.data?.shortBreakMinutes ?? 5 : settingsQuery.data?.longBreakMinutes ?? 15;
  useEffect(() => { if (!running) setSecondsLeft(minutes * 60); }, [minutes, mode, running]);
  useEffect(() => { if (!running) return; const interval = window.setInterval(() => setSecondsLeft((value) => value > 0 ? value - 1 : 0), 1000); return () => window.clearInterval(interval); }, [running]);
  useEffect(() => { if (running && secondsLeft === 0) { setRunning(false); if (startedAt && mode === 'focus') sessionMutation.mutate({ data: { cardId: selectedCard?.id ?? null, durationMinutes: minutes, startedAt, endedAt: new Date().toISOString() } }, { onSuccess: () => { void daily.refetch(); } }); } }, [secondsLeft, running, startedAt, mode, minutes, selectedCard?.id, sessionMutation, daily.refetch]);
  const display = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  function toggleTimer() { if (!running) { setStartedAt(new Date().toISOString()); setRunning(true); } else setRunning(false); }
  function resetTimer() { setRunning(false); setSecondsLeft(minutes * 60); setStartedAt(null); }
  return <div className="page-enter mx-auto max-w-[1100px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10"><PageHeader eyebrow="tempo protegido" title="Pomodoro" description="Foco profundo em blocos pequenos. O resultado fica registrado automaticamente." />
    <div className="grid gap-5 lg:grid-cols-[1fr_330px]"><section className="foco-card quiet-grid flex min-h-[500px] flex-col items-center justify-center p-8"><div className="mb-8 flex rounded-lg border border-border bg-card p-1">{[['focus', 'Foco'], ['short', 'Pausa curta'], ['long', 'Pausa longa']].map(([key, label]) => <button key={key} data-testid={`button-mode-${key}`} onClick={() => { setMode(key as typeof mode); setRunning(false); }} className={cn('pressable rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground', mode === key && 'bg-primary text-primary-foreground')}>{label}</button>)}</div><div className="mono text-[76px] font-medium leading-none tracking-[-.08em] text-foreground sm:text-[112px]" data-testid="timer-display">{display}</div><p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">{selectedCard ? <><span className="h-2 w-2 rounded-full bg-primary" />{selectedCard.title}</> : 'Escolha um card para vincular este ciclo'}</p><div className="mt-9 flex items-center gap-3"><button data-testid="button-toggle-timer" onClick={toggleTimer} className="pressable flex h-14 items-center gap-2 rounded-[10px] bg-primary px-7 text-base font-bold text-primary-foreground">{running ? <Circle className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}{running ? 'Pausar' : 'Começar foco'}</button><button data-testid="button-reset-timer" onClick={resetTimer} className="pressable flex h-14 w-14 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground hover:bg-accent"><RotateCcw className="h-5 w-5" /></button></div></section>
       <aside className="foco-card flex flex-col p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Vincular ao card</h2><p className="mt-1 text-xs text-muted-foreground">Opcional, mas ajuda a medir contexto.</p></div><Link2 className="h-4 w-4 text-muted-foreground" /></div><div className="relative mb-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-search-pomodoro-card" value={cardSearch} onChange={(event) => setCardSearch(event.target.value)} placeholder="Filtrar cards" className="h-9 w-full rounded-lg border border-input bg-background pl-9 text-xs outline-none focus:ring-2 focus:ring-primary/30" /></div><div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto">{cardsQuery.isLoading ? <SkeletonRows count={3} /> : cardsQuery.data?.filter((card) => card.title.toLowerCase().includes(cardSearch.toLowerCase())).slice(0, 12).map((card) => <button key={card.id} data-testid={`button-link-card-${card.id}`} onClick={() => setSelectedCard(card)} className={cn('pressable w-full rounded-lg border p-3 text-left text-xs', selectedCard?.id === card.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent')}><div className="flex items-start gap-2"><span className={cn('mt-0.5 h-2 w-2 rounded-full', selectedCard?.id === card.id ? 'bg-primary' : 'bg-muted-foreground/40')} /><span className="line-clamp-2 font-medium">{card.title}</span></div></button>)}</div><div className="mt-4 border-t border-border pt-4"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Ciclos de hoje</span><b>{daily.isLoading ? '...' : `${daily.data?.pomodorosToday ?? 0} / ${settingsQuery.data?.dailyPomodoroLimit ?? 0}`}</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full w-1/4 rounded-full bg-primary" /></div></div></aside></div>
  </div>;
}

function MetricsPage() {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const metrics = useGetMetrics({ range });
  useRefetchOnCampoGrandeDayChange(metrics.refetch);
  const data = metrics.data as MetricsSummary | undefined;
  function exportCsv() {
    if (!data) return;
    const rows = [['data', 'concluídas', 'ciclos', 'horas foco'], ...(data.focusByDay ?? []).map((day) => [day.date, String(data.completedByDay?.find((item) => item.date === day.date)?.count ?? 0), String(day.pomodoros), String(day.focusHours)])];
    const blob = new Blob([rows.map((row) => row.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `foco-os-${range}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  const maxFocus = Math.max(...(data?.focusByDay ?? []).map((day) => day.focusHours), 1);
  return <div className="page-enter mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10"><PageHeader eyebrow="sinais do seu trabalho" title="Métricas" description="Observe o padrão. Ajuste o sistema, não a sua força de vontade." action={<div className="flex gap-2"><div className="flex rounded-lg border border-border bg-card p-1">{(['7d', '30d'] as const).map((value) => <button key={value} data-testid={`button-range-${value}`} onClick={() => setRange(value)} className={cn('pressable rounded-md px-3 py-2 text-xs font-semibold', range === value && 'bg-primary text-primary-foreground')}>{value === '7d' ? '7 dias' : '30 dias'}</button>)}</div><button data-testid="button-export-csv" onClick={exportCsv} className="pressable flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent"><ArrowDown className="h-4 w-4" />CSV</button></div>} />
    {metrics.isLoading ? <SkeletonRows count={5} /> : metrics.isError ? <QueryMessage error onRetry={() => metrics.refetch()} /> : <div className="space-y-5"><section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ label: 'Taxa de conclusão', value: formatPercent(data?.completionRate), icon: CheckCircle2 }, { label: 'Foco médio / dia', value: `${(data?.averageDailyFocusHours ?? 0).toFixed(1)}h`, icon: Timer }, { label: 'Tempo no Q2', value: formatPercent(data?.q2Percentage), icon: Target }, { label: 'Em atraso', value: data?.overdueCount ?? 0, icon: TrendingDown }].map(({ label, value, icon: Icon }) => <div key={label} className="foco-card p-5"><Icon className="h-4 w-4 text-primary" /><p className="mt-5 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold tracking-[-.05em]" data-testid={`metric-value-${label}`}>{value}</p></div>)}</section><div className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]"><section className="foco-card p-5 sm:p-6"><div className="mb-8 flex items-start justify-between"><div><h2 className="font-bold">Foco por dia</h2><p className="mt-1 text-xs text-muted-foreground">Horas protegidas no período</p></div><span className="mono text-xs text-primary">{data?.focusByDay?.reduce((sum, item) => sum + item.focusHours, 0).toFixed(1)}h total</span></div><div className="flex h-56 items-end gap-2 border-b border-border pb-0">{(data?.focusByDay ?? []).map((day) => <div key={day.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{day.focusHours.toFixed(1)}h</span><div className="w-full max-w-8 rounded-t-md bg-primary/75 transition-all group-hover:bg-primary" style={{ height: `${Math.max(5, day.focusHours / maxFocus * 100)}%` }} /><span className="text-[10px] text-muted-foreground">{formatWeekday(day.date).replace('.', '')}</span></div>)}</div></section><section className="foco-card p-5"><h2 className="font-bold">Cards em aberto</h2><p className="mt-1 text-xs text-muted-foreground">Distribuição por quadrante</p><div className="mt-7 space-y-4">{(data?.openByQuadrant ?? []).map((item) => { const q = quadrants.find((quadrant) => quadrant.name === item.quadrant); const total = Math.max(...(data?.openByQuadrant ?? []).map((entry) => entry.count), 1); return <div key={item.quadrant}><div className="mb-1.5 flex justify-between text-xs"><span>{q?.short ?? item.quadrant}</span><b>{item.count}</b></div><div className="h-2 rounded-full bg-secondary"><div className={cn('h-full rounded-full', q?.name === 'Q1 - Fazer agora' ? 'bg-red-400' : q?.name === 'Q2 - Agendar' ? 'bg-blue-400' : q?.name === 'Q3 - Delegar' ? 'bg-amber-400' : 'bg-slate-400')} style={{ width: `${item.count / total * 100}%` }} /></div></div>})}</div></section></div><section className="foco-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Foco por área</h2><p className="mt-1 text-xs text-muted-foreground">Onde seu tempo está indo</p></div><SlidersHorizontal className="h-4 w-4 text-muted-foreground" /></div><div className="flex flex-wrap gap-2">{(data?.focusByArea ?? []).map((item) => <div key={item.area} className="rounded-lg bg-accent px-3 py-2"><span className="text-xs text-muted-foreground">{item.area}</span><b className="ml-2 text-sm">{item.focusHours.toFixed(1)}h</b></div>)}</div></section></div>}
  </div>;
}

function SettingsPage({ onThemeChange }: { onThemeChange: (theme: 'dark' | 'light') => void }) {
  const settings = useGetSettings();
  const connection = useGetConnection();
  const update = useUpdateSettings();
  const [form, setForm] = useState({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4, dailyPomodoroLimit: 8, yellowLoadAt: 4, redLoadAt: 7, theme: 'dark' as 'dark' | 'light' });
  useEffect(() => { if (settings.data) setForm({ focusMinutes: settings.data.focusMinutes, shortBreakMinutes: settings.data.shortBreakMinutes, longBreakMinutes: settings.data.longBreakMinutes, longBreakEvery: settings.data.longBreakEvery, dailyPomodoroLimit: settings.data.dailyPomodoroLimit, yellowLoadAt: settings.data.yellowLoadAt, redLoadAt: settings.data.redLoadAt, theme: settings.data.theme }); }, [settings.data]);
  function setField(field: keyof typeof form, value: string | boolean) { setForm((current) => ({ ...current, [field]: typeof value === 'boolean' ? value : field === 'theme' ? value : Number(value) } as typeof current)); }
  function save() { update.mutate({ data: form }, { onSuccess: () => onThemeChange(form.theme) }); }
  return <div className="page-enter mx-auto max-w-[1000px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10"><PageHeader eyebrow="seu sistema" title="Configurações" description="Ajuste o ritmo para que o Foco OS trabalhe a seu favor." />
    {settings.isLoading ? <SkeletonRows count={4} /> : settings.isError ? <QueryMessage error onRetry={() => settings.refetch()} /> : <div className="space-y-5"><section className="foco-card p-5 sm:p-7"><div className="mb-7"><h2 className="text-lg font-bold">Ritmo do Pomodoro</h2><p className="mt-1 text-sm text-muted-foreground">Os valores são aplicados ao próximo ciclo.</p></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[['focusMinutes', 'Foco', 'min'], ['shortBreakMinutes', 'Pausa curta', 'min'], ['longBreakMinutes', 'Pausa longa', 'min'], ['longBreakEvery', 'Pausa longa a cada', 'ciclos']].map(([field, label, suffix]) => <label key={field} className="space-y-2"><span className="text-xs font-semibold">{label}</span><div className="relative"><input data-testid={`input-settings-${field}`} type="number" value={form[field as keyof typeof form] as number} onChange={(event) => setField(field as keyof typeof form, event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 pr-14 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span></div></label>)}</div><div className="mt-7 grid gap-5 sm:grid-cols-3"><label className="space-y-2"><span className="text-xs font-semibold">Limite diário</span><input data-testid="input-settings-dailyLimit" type="number" value={form.dailyPomodoroLimit} onChange={(event) => setField('dailyPomodoroLimit', event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-primary/30" /></label><label className="space-y-2"><span className="text-xs font-semibold">Carga amarela a partir de</span><input data-testid="input-settings-yellow" type="number" value={form.yellowLoadAt} onChange={(event) => setField('yellowLoadAt', event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-primary/30" /></label><label className="space-y-2"><span className="text-xs font-semibold">Carga vermelha a partir de</span><input data-testid="input-settings-red" type="number" value={form.redLoadAt} onChange={(event) => setField('redLoadAt', event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-primary/30" /></label></div></section>
      <section className="foco-card p-5 sm:p-7"><div className="mb-6"><h2 className="text-lg font-bold">Aparência</h2><p className="mt-1 text-sm text-muted-foreground">Escolha como o seu espaço de foco aparece.</p></div><div className="grid gap-3 sm:grid-cols-2"><button data-testid="button-settings-dark" onClick={() => { setField('theme', 'dark'); onThemeChange('dark'); }} className={cn('pressable flex items-center gap-4 rounded-lg border p-4 text-left', form.theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border')}><Moon className="h-5 w-5" /><span><b className="block text-sm">Grafite</b><small className="text-xs text-muted-foreground">Escuro e concentrado</small></span>{form.theme === 'dark' && <Check className="ml-auto h-4 w-4 text-primary" />}</button><button data-testid="button-settings-light" onClick={() => { setField('theme', 'light'); onThemeChange('light'); }} className={cn('pressable flex items-center gap-4 rounded-lg border p-4 text-left', form.theme === 'light' ? 'border-primary bg-primary/10' : 'border-border')}><Sun className="h-5 w-5" /><span><b className="block text-sm">Luz baixa</b><small className="text-xs text-muted-foreground">Claro e arejado</small></span>{form.theme === 'light' && <Check className="ml-auto h-4 w-4 text-primary" />}</button></div></section>
      <section className="foco-card p-5 sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold">Conexão</h2><span className={cn('h-2 w-2 rounded-full', connection.data?.connected ? 'bg-emerald-500' : 'bg-amber-500')} /></div><p className="mt-1 text-sm text-muted-foreground">{connection.data?.message || settings.data?.connection.message || 'Verificando conexão...'}</p></div><div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><Link2 className="h-4 w-4 text-primary" />{connection.data?.mode === 'demo' ? 'Modo demo' : 'Trello'}</div></div></section>
      <div className="flex items-center justify-end gap-3"><span className={cn('text-xs text-emerald-600', update.isSuccess ? 'opacity-100' : 'opacity-0')}>Preferências salvas</span><button data-testid="button-save-settings" onClick={save} disabled={update.isPending} className="pressable rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{update.isPending ? 'Salvando...' : 'Salvar preferências'}</button></div>
    </div>}
    <section className="foco-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
      <div>
        <h2 className="font-bold">Sessão protegida</h2>
        <p className="mt-1 text-sm text-muted-foreground">O acesso permanece ativo por até 7 dias neste navegador.</p>
      </div>
      <LogoutButton className="w-full sm:w-auto" />
    </section>
  </div>;
}

function Router({ theme, setTheme }: { theme: 'dark' | 'light'; setTheme: (theme: 'dark' | 'light') => void }) {
  const [collapsed, setCollapsed] = useState(false);
  return <AppShell collapsed={collapsed} setCollapsed={setCollapsed} theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Switch>
    <Route path="/" component={TodayPage} />
    <Route path="/matriz" component={MatrixPage} />
    <Route path="/semana" component={WeekPage} />
    <Route path="/pomodoro" component={PomodoroPage} />
    <Route path="/metricas" component={MetricsPage} />
    <Route path="/configuracoes">{() => <SettingsPage onThemeChange={setTheme} />}</Route>
    <Route component={NotFound} />
  </Switch></AppShell>;
}

function App() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => (localStorage.getItem('foco-theme') as 'dark' | 'light' | null) ?? 'dark');
  const setTheme = (next: 'dark' | 'light') => { setThemeState(next); localStorage.setItem('foco-theme', next); };
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  return <QueryClientProvider client={queryClient}><CampoGrandeTodayProvider><TooltipProvider><ErrorBoundary><PasswordGate><Router theme={theme} setTheme={setTheme} /><Toaster /></PasswordGate></ErrorBoundary></TooltipProvider></CampoGrandeTodayProvider></QueryClientProvider>;
}

export default App;