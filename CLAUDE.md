# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Kern in één alinea

Buildless vanilla-JS webapp, **geen dependencies, geen bundler, geen buildstap**. Je bewerkt `src/*` en ververst de browser. De data leeft niet in de repo maar in **Supabase**; de app is een spiegel daarvan. De acquisitie-pipeline heeft een tweede bron van waarheid: een **Google Drive-map** die via een script naar Supabase wordt gesynct.

## Commando's

```bash
npm start            # of: npm run dev — statische server op http://localhost:4173 (server.js)
npm run lint         # GEEN echte linter: alleen `node --check` syntaxcontrole op de kernbestanden
node scripts/sync-acquisitie.mjs --dry     # acquisitie-sync: toon wat er zou gebeuren, schrijf niets
node scripts/sync-acquisitie.mjs           # live sync naar Supabase (breekt af bij onleesbare PDF's)
node scripts/sync-acquisitie.mjs --force   # sync ook met onleesbare PDF's (bewust)
node scripts/test-sync-unreadable.mjs      # regressietest voor de sync (fixture, geen Drive nodig)
```

Let op: het `npm test`-commando uit de README bestaat **niet** (er is geen `test`-script). De enige geautomatiseerde test is `test-sync-unreadable.mjs`. De README beschrijft bovendien een **verouderde** architectuur (LocalStorage, `src/domain/`, `seed.js`, `products`/`deliveries`/`reviews`) die niet meer bestaat — **vertrouw de code, niet de README.**

## Operationele regels (belangrijk)

- **Werk op branch `cockpit`. Merge NIET naar `main`.** Elke merge naar main triggert een betaalde Netlify-deploy. De gebruiker merget zelf wanneer die er klaar voor is. Commit + push naar cockpit is prima.
- **Data zit in Supabase, niet in de repo.** Handmatige datacorrecties gaan via de Supabase MCP (`execute_sql`, project ref `jeqvjtnxgxpjviwhjmzr`), niet via codewijzigingen. RLS staat anon lezen/schrijven toe.
- **De Drive-map is leidend voor de acquisitie-pipeline.** Statusverschuivingen (offerte → gefactureerd → betaald) doe je door bestanden te verplaatsen in de map en te syncen, niet door los in het dashboard te typen.

## Architectuur

### Twee voordeuren, één statische site
- `index.html` — de "cockpit" landingspagina, volledig self-contained (~54 KB, eigen inline CSS/JS).
- `dashboard.html` — laadt `src/main.js` → de SPA. Bereikbaar op `/dashboard`.
- `server.js` serveert alles statisch op `:4173` en spiegelt de Netlify-functions lokaal (`/api/*`). Netlify publiceert de root (`publish = "."`) zonder build; `_redirects` + `netlify.toml` regelen routing en een wachtwoord-edge-function (`gate.js`, actief als `COCKPIT_PASSWORD` gezet is).

### De SPA (`src/app.js`)
Eén groot bestand. Hash-router (`#/`, `#/acquisitie`, `#/projecten`, `#/taken`, `#/finance`, `#/klanten`). Rendering is **template-literals**: `renderApp()` bouwt een HTML-string en zet die in `#app`, daarna `attachEvents()`. Geen framework, geen virtual DOM — na elke mutatie volledig herrenderen. `main.js` (8 regels) doet alleen bootstrap: `renderApp()` bij DOMContentLoaded + `loadAll()`.

### Datalaag (`src/data/store.js`)
Praat met Supabase via **lokaal gevendorde** `lib/vendor/supabase-js.js` (bewust géén runtime-import van esm.sh — dat brak het dashboard). Stateless: geen login, geen localStorage. Vier tabellen:

| Tabel | cache-key in `getDatabase()` |
|---|---|
| `customers` | `customers` |
| `projects` | `projects` |
| `tasks` | `tasks` |
| `finance_entries` | **`finance`** |

Publieke API: `loadAll()`, `getDatabase()` (sync cache), `subscribe()`, en upsert/delete-helpers per entiteit. Schrijven gaat via `upsert` (merge op `id`). `finance_entries.date` is **NOT NULL** en `source` heeft een CHECK-constraint (o.a. `invoice`/`manual`, niet vrij tekst).

### Funnel-vocabulaire (cross-cutting, zit in `app.js`)
Ruwe `projects.pipeline_status` ≠ de buckets die de UI toont. `acquisitieBuckets(db)` vertaalt alles naar één gedeelde funnel: **Lead · Pending · Geaccepteerd · Gefactureerd · Betaald · Afgewezen**. Cruciaal:
- **Gefactureerd** en **Betaald** komen NIET uit `pipeline_status` maar uit `finance_entries` (payment_status `gefactureerd`/`ontvangen`), **jaargescoped**. Zo matchen het `#/acquisitie`-bord, de Overview-tegels en de Finance-pagina exact.
- "Volgende actie" (op Projecten/Acquisitie/detail) toont de **eerstvolgende open taak**; de handmatige `next_action` is fallback en wordt verborgen als de datum verlopen is (`nextActionHtml()` / `nextOpenTask()`).

Wijzig je één van deze plekken, wijzig ze allemaal via de gedeelde helpers — anders lopen bord, tegels en Finance uiteen.

### Serverless (`lib/`, `netlify/`)
`lib/integrations.mjs` (AI-nieuws, Netlify-sites, Supabase-projects) wordt gedeeld door `server.js` (lokaal) én `netlify/functions/*.mjs` (productie), zodat `/api/*` in beide werkt.

## Acquisitie-sync (`scripts/sync-acquisitie.mjs`)
Leest de Drive-map `Morgen Academy/Acquisitie` (statusmappen `1. Pending` … `5. Betaald`) en upsert naar Supabase. Idempotent via deterministische id's (`prj_acq_<nummer>`, of alias naar een bestaand project via `ID_ALIAS`). Offerte-PDF's → projecten; Karin's factuurmappen in `4.`/`5.` → `finance_entries`. Ontwerp: `docs/superpowers/specs/2026-06-16-acquisitie-dashboard-sync-design.md`.

**Google Drive-valkuil:** File Stream houdt bestanden soms als placeholder (metadata lokaal, inhoud niet). `pdftotext` hangt dan of geeft lege output. `pdfText()` behandelt dat als onleesbaar (`null`), slaat het bestand over, en een live-run **breekt af** i.p.v. spookprojecten aan te maken of seed-regels te wissen. Vereist `pdftotext` (`brew install poppler`).
