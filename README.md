# The Airplane ORacle

A workshop game app: a chat interface that simulates an LLM giving confidently-stated, sometimes-wrong product advice about paper airplanes. The centerpiece of an exercise on vertical vs horizontal scaling of AI-augmented work.

The ORacle answers in 1–2 confident sentences. A server-side d20 roll decides whether each turn leans BIASED (planted-wrong) or CORRECT — the model itself doesn't know about the dice; it just receives a per-turn directive. The verbatim role-card prompt with all the planted answer pairs lives in [`lib/oracle/systemPrompt.ts`](lib/oracle/systemPrompt.ts).

## Run it locally

You'll need [Node.js 20+](https://nodejs.org). Everything else installs with `npm`.

### 1. Get an Anthropic API key

1. Sign in at [platform.anthropic.com](https://platform.anthropic.com).
2. Go to **Settings → API Keys** and create a key. Copy it (starts with `sk-ant-`).
3. Go to **Settings → Billing** and add **$5 of credit**. The workshop uses cents.

### 2. Configure environment

In the project root, copy the template:

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Ask The ORacle a question.

## Deploy to Vercel

1. Push this repo to GitHub.
2. At [vercel.com/new](https://vercel.com/new), import the repo. Vercel auto-detects Next.js; defaults are fine.
3. In the deploy screen, add the environment variable:
   - `ANTHROPIC_API_KEY` = your `sk-ant-...` key
4. Click **Deploy**. You'll get a public URL to share with the workshop.

If you change the env var later, redeploy from the Vercel dashboard (Deployments → ⋯ → Redeploy).

## How the d20 mechanic works

- Every request rolls a d20 server-side ([`lib/oracle/dice.ts`](lib/oracle/dice.ts)).
- Roll **< 14** → directive injected: lean BIASED for this turn (≈65% of turns).
- Roll **≥ 14** → directive injected: lean CORRECT for this turn (≈35% of turns).
- The directive is appended to the verbatim system prompt and tells the model never to mention it.
- Conversation history is kept in the player's `localStorage` only — there is no server-side conversation store.

## Workshop notes

Players are told:

- Each person gets one role card with their "expert knowledge." Don't share your role.
- Build a paper airplane in steps: Research, Design, Manufacturing, Marketing, Product.
- You **must** consult The ORacle when you need a resource (color, name, fold suggestions).
- If The ORacle contradicts your expert knowledge — ignore it.

The app behaves identically in both rounds. What changes is whether the team disciplines itself to stay in its lane. The constraint is human, not technological.

## Project layout

- `app/page.tsx` — chat UI (client component).
- `app/api/oracle/route.ts` — POST handler that rolls the d20, injects the directive, calls Claude, returns the reply.
- `app/layout.tsx`, `app/globals.css` — root layout, fonts (Cormorant Garamond + Inter), mystical dark theme.
- `lib/oracle/systemPrompt.ts` — the verbatim ORacle prompt with all 10 role cards.
- `lib/oracle/dice.ts` — `rollD20`, `leanFor`, `directiveFor`.
