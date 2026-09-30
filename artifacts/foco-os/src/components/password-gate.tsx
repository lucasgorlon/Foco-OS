import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, KeyRound, LogOut, Target } from "lucide-react";

type AccessState = "checking" | "signed-out" | "signed-in";
type SessionContextValue = { logout: () => Promise<void> };

const SessionContext = createContext<SessionContextValue | null>(null);
const AUTH_API = "/api/auth";

export const usePasswordSession = (): SessionContextValue => {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("usePasswordSession deve ser usado dentro de PasswordGate.");
  }
  return session;
};

async function getResponseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // The server may return an empty or non-JSON error response.
  }
  return "Não foi possível validar o acesso. Tente novamente.";
}

function AccessScreen({
  busy,
  error,
  notice,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  notice: string;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(password);
  }

  return (
    <main className="foco-shell grid min-h-screen place-items-center px-5 py-10">
      <div className="page-enter w-full max-w-[420px]">
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Target className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-extrabold tracking-[-0.03em]">Foco OS</p>
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              clareza diária
            </p>
          </div>
        </div>

        <section className="foco-card p-6 sm:p-8">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
            acesso protegido
          </p>
          <h1 className="text-2xl font-extrabold tracking-[-0.04em]">
            Entre no seu espaço de foco
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Informe a senha para acessar suas tarefas, sessões e métricas.
          </p>

          <form className="mt-7 space-y-4" onSubmit={submit}>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value="Foco OS"
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
            />
            <label className="block space-y-2">
              <span className="text-xs font-semibold">Senha de acesso</span>
              <input
                data-testid="input-app-password"
                type="password"
                name="password"
                autoComplete="current-password"
                maxLength={1024}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Digite sua senha"
                aria-describedby={error ? "password-error" : undefined}
              />
            </label>

            {error && (
              <p
                id="password-error"
                className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
            {notice && !error && (
              <p className="text-sm text-muted-foreground" role="status">
                {notice}
              </p>
            )}

            <button
              data-testid="button-login"
              type="submit"
              disabled={busy}
              className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Verificando..." : "Entrar"}
              {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </form>
          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            A sessão permanece ativa por até 7 dias neste navegador.
          </p>
        </section>
      </div>
    </main>
  );
}

export function LogoutButton({
  collapsed = false,
  className = "",
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { logout } = usePasswordSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setBusy(true);
    setError("");
    try {
      await logout();
    } catch {
      setError("Não foi possível encerrar a sessão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        data-testid="button-logout"
        type="button"
        onClick={() => void handleLogout()}
        disabled={busy}
        aria-label="Sair da sessão"
        className="pressable flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-60"
      >
        <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        {!collapsed && (
          <span className="text-sm">{busy ? "Saindo..." : "Sair"}</span>
        )}
      </button>
      {error && (
        <p className="px-3 pb-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function PasswordGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [access, setAccess] = useState<AccessState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const checkSession = useCallback(
    async (showExpiredNotice = false): Promise<boolean> => {
      try {
        const response = await fetch(`${AUTH_API}/session`, {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (response.ok) {
          setAccess("signed-in");
          setError("");
          return true;
        }

        queryClient.clear();
        setAccess("signed-out");
        if (response.status === 401) {
          setError("");
          if (showExpiredNotice) setNotice("Sua sessão expirou. Entre novamente.");
        } else {
          setError(await getResponseError(response));
        }
      } catch {
        setAccess("signed-out");
        setError("Não foi possível verificar o acesso. Confira sua conexão e tente novamente.");
      }
      return false;
    },
    [queryClient],
  );

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (access !== "signed-in") return;
    const verify = () => void checkSession(true);
    const interval = window.setInterval(verify, 60_000);
    window.addEventListener("focus", verify);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", verify);
    };
  }, [access, checkSession]);

  const login = useCallback(
    async (password: string) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const response = await fetch(`${AUTH_API}/login`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        });
        if (!response.ok) {
          setError(await getResponseError(response));
          return;
        }
        queryClient.clear();
        setAccess("signed-in");
      } catch {
        setError("Não foi possível entrar. Confira sua conexão e tente novamente.");
      } finally {
        setBusy(false);
      }
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const response = await fetch(`${AUTH_API}/logout`, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok && response.status !== 401) {
      throw new Error("Não foi possível encerrar a sessão.");
    }
    queryClient.clear();
    setNotice("Sessão encerrada.");
    setError("");
    setAccess("signed-out");
  }, [queryClient]);

  if (access === "checking") {
    return (
      <main className="foco-shell grid min-h-screen place-items-center px-5">
        <p className="text-sm text-muted-foreground" role="status">
          Verificando sessão...
        </p>
      </main>
    );
  }

  if (access === "signed-out") {
    return (
      <AccessScreen
        busy={busy}
        error={error}
        notice={notice}
        onSubmit={login}
      />
    );
  }

  return (
    <SessionContext.Provider value={{ logout }}>
      {children}
    </SessionContext.Provider>
  );
}