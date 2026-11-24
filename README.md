# DecidEat

**Live app: https://decideat.app.space**

DecidEat settles the "where should we eat?" debate. One person opens a
**table**, sets the constraints (budget, area, cuisine hints) and shares the
link. Friends join the table, nominate candidate restaurants, and vote
**yes/no** on each — yes means "I'd happily eat there", no is a real veto.
Votes, tallies, rankings and who's at the table update live for everyone.

When the group is ready, the table gets decided: the host can lock in the
leader, or the group can ask the built-in **AI host** to call it.

## The AI host

An in-app assistant (Anthropic Claude via DeepSpace's managed AI — the model
is pinned server-side to Claude Sonnet 5, and the model picker only offers
Anthropic models). It has real access to the table's data through record
tools and can:

- report the standings (tallies, leader, close races, vetoes),
- recommend a pick by weighing votes against the table's budget, area and
  cuisine constraints,
- suggest a tiebreak, and
- decide the table — only when explicitly asked, and only for the table's
  owner (AI tool calls run under the caller's permissions).

It resolves references like "this table" from the caller's memberships, so
nobody is ever asked for a table ID. AI usage is billed to the app owner, so
guests never need their own AI account.

## How it's built

Built on the [DeepSpace](https://docs.deep.space) SDK (React + Vite
frontend, Hono worker, Durable Object data layer) and deployed to
decideat.app.space.

- **Data model** — four collections in the app's RecordRoom:
  `tables` (title, status, winnerId, budgetLevel, areaLabel, cuisineHints,
  note), `members` (tableId + userId, unique together), `candidates`
  (tableId, name, cuisine, priceLevel), `votes` (candidateId + voterId,
  unique together — one vote per person per candidate, enforced by the data
  layer). Tallies are computed from the votes records, so every client sees
  the same numbers from the same source.
- **Real-time sync** — candidates and votes stream over the records
  WebSocket; persistence is the Durable Object's SQLite store (no
  localStorage, no third-party backend).
- **Presence** — each room joins a presence room (`table:<id>`), so member
  chips show who is at the table right now.
- **Chat** — every table gets its own channel (`table-<id>`) on DeepSpace's
  messaging feature.
- **Auth** — DeepSpace accounts (Google sign-in); the lobby lists only the
  tables you're a member of.

## Run locally

```sh
npm install
npx deepspace auth login   # your own DeepSpace account
npx deepspace dev start    # local dev server
npx deepspace deploy       # deploy to <name>.app.space
```
