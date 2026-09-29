import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/docs", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Foco OS · API para automações</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #101115; color: #ececf2; }
      body { margin: 0; padding: 40px 20px; }
      main { max-width: 820px; margin: 0 auto; }
      .eyebrow { color: #aaa9bf; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 10px 0; font-size: clamp(30px, 6vw, 44px); letter-spacing: -.04em; }
      p, li { color: #b2b2c0; line-height: 1.65; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      code { color: #c4bdff; }
      pre { overflow: auto; padding: 18px; border: 1px solid #2c2c37; border-radius: 12px; background: #181820; color: #d8d6e2; line-height: 1.6; }
      .endpoint { display: grid; grid-template-columns: 76px 1fr; gap: 12px; padding: 13px 0; border-bottom: 1px solid #292933; }
      .method { color: #aaa1ff; font: 600 12px ui-monospace, monospace; }
      .path { font: 500 14px ui-monospace, monospace; }
      section { margin-top: 34px; }
      a { color: #bcb5ff; }
      @media (max-width: 520px) { body { padding: 28px 16px; } .endpoint { grid-template-columns: 1fr; gap: 4px; } }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Foco OS · API</p>
      <h1>Automações com segurança</h1>
      <p>Base da API: <code>/api</code>. Todos os endpoints desta página exigem a chave configurada no Secret <code>POS_API_KEY</code>, enviada no header <code>x-api-key</code>. O valor nunca é mostrado no app nem nesta documentação.</p>
      <section aria-labelledby="endpoints">
        <h2 id="endpoints">Endpoints</h2>
        <div class="endpoint"><span class="method">GET</span><code class="path">/api/resumo-diario</code></div>
        <div class="endpoint"><span class="method">GET</span><code class="path">/api/resumo-semanal</code></div>
        <div class="endpoint"><span class="method">POST</span><code class="path">/api/pomodoro</code></div>
        <div class="endpoint"><span class="method">GET</span><code class="path">/api/health</code></div>
      </section>
      <section>
        <h2>Exemplo de chamada</h2>
        <pre><code>curl -H "x-api-key: SUA_POS_API_KEY" \\
  https://seu-dominio/api/resumo-diario</code></pre>
        <p>Guarde a chave no gerenciador de Secrets do ambiente e na conexão do Make.com. Não a coloque em URLs, parâmetros ou código do navegador.</p>
      </section>
      <section>
        <h2>Registrar uma sessão</h2>
        <p>Envie <code>durationMinutes</code> (inteiro em minutos), <code>startedAt</code> (data ISO 8601), <code>cardId</code> (opcional) e <code>endedAt</code> (opcional; quando omitido, é calculado a partir da duração).</p>
        <pre><code>POST /api/pomodoro
Content-Type: application/json
x-api-key: SUA_POS_API_KEY

{
  "cardId": "id-do-card",
  "durationMinutes": 25,
  "startedAt": "2026-09-24T13:00:00.000Z"
}</code></pre>
      </section>
      <section>
        <h2>Respostas e erros</h2>
        <p>As respostas são JSON. Sem chave válida, a API retorna <code>401</code>; se <code>POS_API_KEY</code> ainda não estiver configurada, retorna <code>503</code>. O estado do Trello é informado como conectado ou modo demonstração.</p>
      </section>
    </main>
  </body>
</html>`);
});

export default router;