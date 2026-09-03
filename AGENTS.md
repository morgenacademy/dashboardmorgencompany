# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

Houd dit bestand inhoudelijk gelijk aan `CLAUDE.md`; alleen deze openingszin is tool-specifiek.

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
node scripts/test-finance-model.mjs        # regressietest voor actuals versus prognose (geen netwerk nodig)
node scripts/test-label-model.mjs          # regressietest voor label/kanaal-afleiding (geen netwerk nodig)
node scripts/test-analyse.mjs              # regressietest voor de Analyse-tab: model + gaps (geen netwerk nodig)
```

Let op: het `npm test`-commando uit de README bestaat **niet** (er is geen `test`-script). Gebruik de twee gerichte regressietests hierboven. De README beschrijft bovendien een **verouderde** architectuur (LocalStorage, `src/domain/`, `seed.js`, `products`/`deliveries`/`reviews`) die niet meer bestaat — **vertrouw de code, niet de README.**

## Operationele regels (belangrijk)

- **Werk op branch `cockpit`. Merge NIET naar `main`.** Elke merge naar main triggert een betaalde Netlify-deploy. De gebruiker merget zelf wanneer die er klaar voor is. Commit + push naar cockpit is prima.
- **Data zit in Supabase, niet in de repo.** Handmatige datacorrecties gaan via de Supabase MCP (`execute_sql`, project ref `jeqvjtnxgxpjviwhjmzr`), niet via codewijzigingen. RLS staat anon lezen/schrijven toe.
- **De Drive-map is leidend voor de acquisitie-pipeline.** Statusverschuivingen (offerte → geaccepteerd → gefactureerd → betaald) doe je door bestanden te verplaatsen in de map en te syncen, niet door los in het dashboard te typen.
- **Draai de sync altijd eerst met `--dry` en lees de uitvoer** voor je live gaat. Hij raakt echt geld: hij schrijft finance-regels en kan seed-regels vervangen. Bij twijfel over een bedrag: pinnen in de overrides, niet gokken.

## Architectuur

### Twee voordeuren, één statische site
- `index.html` — de "cockpit" landingspagina, volledig self-contained (~54 KB, eigen inline CSS/JS).
- `dashboard.html` — laadt `src/main.js` → de SPA. Bereikbaar op `/dashboard`.
- `server.js` serveert alles statisch op `:4173` en spiegelt de Netlify-functions lokaal (`/api/*`). Netlify publiceert de root (`publish = "."`) zonder build; `_redirects` + `netlify.toml` regelen routing en een wachtwoord-edge-function (`gate.js`, actief als `COCKPIT_PASSWORD` gezet is).

### De SPA (`src/app.js`)
Eén groot bestand. Hash-router (`#/`, `#/analyse`, `#/acquisitie`, `#/projecten`, `#/taken`, `#/finance`, `#/klanten`). Rendering is **template-literals**: `renderApp()` bouwt een HTML-string en zet die in `#app`, daarna `attachEvents()`. Geen framework, geen virtual DOM — na elke mutatie volledig herrenderen. `main.js` (8 regels) doet alleen bootstrap: `renderApp()` bij DOMContentLoaded + `loadAll()`.

### Datalaag (`src/data/store.js`)
Praat met Supabase via **lokaal gevendorde** `lib/vendor/supabase-js.js` (bewust géén runtime-import van esm.sh — dat brak het dashboard). Stateless: geen login, geen localStorage. Vier tabellen:

| Tabel | cache-key in `getDatabase()` |
|---|---|
| `customers` | `customers` |
| `projects` | `projects` |
| `tasks` | `tasks` |
| `finance_entries` | **`finance`** |

Publieke API: `loadAll()`, `getDatabase()` (sync cache), `subscribe()`, en upsert/delete-helpers per entiteit. Schrijven gaat via `upsert` (merge op `id`). `finance_entries.date` is **NOT NULL** en `source` heeft een CHECK-constraint (o.a. `invoice`/`manual`/`bank_export`, niet vrij tekst).

### Finance: actual versus prognose (`src/finance-model.js`)
Actuals en prognoses zijn bewust gescheiden en gebruiken op Overview en Finance dezelfde helpers:

- Een `bank_export`-regel is een **werkelijke transactie** en telt alleen in de eigen maand, ook als `recurring === 'monthly'`.
- `recurring` betekent bij bankregels alleen dat de leverancier terugkerend kan zijn; het is nooit toestemming om iedere historische betaling door te trekken.
- De kostenprognose begint na de lopende (mogelijk onvolledige) maand en gebruikt voor bankregels het leverancierstotaal van de laatste volledig afgesloten maand.
- Een handmatige maandregel (`source === 'manual'`, `recurring === 'monthly'`) is een expliciete run-rate: wel prognose, geen actual.
- Pas rekenregels aan in `src/finance-model.js` en dek ze af in `scripts/test-finance-model.mjs`; bouw geen tweede Finance-logica in `app.js`.

### Analyse-tab (`src/ui/analyse.js`, route `#/analyse`)
Zelfstandige module met drie **pure** exports (geen DOM): `analyseModel(db, {year})` (veredeling per label, sectoren, kanalen, recurring, marge), `analyseGaps(db)` (vijf datakwaliteit-checks) en `renderAnalyse(db, {fmtCurrency, escapeHtml})`. `app.js` levert alleen nav-item, route en de wizard-events. Dek rekenregels af in `scripts/test-analyse.mjs`; bouw geen tweede analyse-logica in `app.js`.

- **Twee omzetdefinities, bewust.** De Overview-per-label-tegels tellen *toegezegd* werk (`actual_amount + forecast_amount` over committed projecten). De Analyse-tab telt *gerealiseerd + open pipeline* uit Finance. De Marge-kaart is **cash**: ontvangen − werkelijke uitgaven (kosten staan op `payment_status='verwacht'` maar zijn echte `bank_export`-transacties, dus niet op status filteren). Drie verschillende bases — de UI labelt ze expliciet; laat ze niet stilletjes samenvloeien.
- **Twee kolommen op `projects`.** `label_reviewed` (bool, default false) scheidt door-mens-bevestigd van door-sync-geraden. `channel` (`direct`/`michielpro`/`karin`, default `direct`) maakt partneromzet een echte dimensie i.p.v. een grep op factuurtekst. Beide sync-veilig: de sync patcht bij bestaande projecten alleen `pipeline_status`.
- **Sync leidt af, niet raden.** `src/label-model.js` (`deriveServiceLabel`/`deriveChannel`, gedeeld door sync én app) zet bij nieuwe projecten een afgeleid label + kanaal, met `label_reviewed=false` — zo komt een geraden label (bv. `training`→`train`, terwijl het `inspire` had gemoeten) als "klopt dit?" langs de wizard i.p.v. stil te verdwijnen. `deriveChannel` leest de **haystack** (mapnaam), niet de projectnaam: die bevat de eindklant, niet 'michielpro'.
- De **dubbele-klant-check signaleert alleen** — de duurzame fix zit in `KNOWN_CLIENTS`/`ID_ALIAS` van de sync, niet in een merge in het dashboard (die komt bij de volgende sync terug).

### Funnel-vocabulaire (cross-cutting, zit in `app.js`)
Ruwe `projects.pipeline_status` ≠ de buckets die de UI toont. `acquisitieBuckets(db)` vertaalt alles naar één gedeelde funnel: **Lead · Pending · Geaccepteerd · Gefactureerd · Betaald · Afgewezen**. Cruciaal:
- **Gefactureerd** en **Betaald** komen NIET uit `pipeline_status` maar uit `finance_entries` (payment_status `gefactureerd`/`ontvangen`), **jaargescoped**. Zo matchen het `#/acquisitie`-bord, de Overview-tegels en de Finance-pagina exact.
- "Volgende actie" (op Projecten/Acquisitie/detail) toont de **eerstvolgende open taak**; de handmatige `next_action` is fallback en wordt verborgen als de datum verlopen is (`nextActionHtml()` / `nextOpenTask()`).

Wijzig je één van deze plekken, wijzig ze allemaal via de gedeelde helpers — anders lopen bord, tegels en Finance uiteen.

**Geld hoort in `finance_entries`, niet alleen in `projects.forecast_amount`.** Een bedrag dat alleen als forecast op een project staat, telt nergens in Finance mee (Verwacht/Omzet lezen puur uit finance). Daarom schrijft de sync voor `2. Geaccepteerd` een `verwacht`-regel: toegezegd werk = geld dat eraan komt. Zet je zoiets handmatig neer, doe dat dan ook als finance-regel.

### Serverless (`lib/`, `netlify/`)
`lib/integrations.mjs` (AI-nieuws, Netlify-sites, Supabase-projects, SharePoint) wordt gedeeld door `server.js` (lokaal) én `netlify/functions/*.mjs` (productie), zodat `/api/*` in beide werkt.

**SharePoint (`/api/sharepoint`).** Microsoft Graph via de client-credentials-flow: een Azure-app-registratie met application permission `Sites.Read.All` plus admin consent. Zet `MS_TENANT_ID`, `MS_CLIENT_ID` en `MS_CLIENT_SECRET` als env-vars in Netlify (nooit in de client). Optioneel: `SHAREPOINT_HOST` (default `morgencompany.sharepoint.com`) en `SHAREPOINT_SITES` (komma-lijst met sitepaden; leeg = alle sites die de app mag zien). Ontbreken de drie verplichte vars, dan geeft het endpoint netjes `ok:false` met uitleg en blijft de tegel gewoon doorlinken naar SharePoint. De flyout haalt per site de top-level items van de standaard documentbibliotheek en sorteert zelf op `lastModifiedDateTime`: `$orderby` levert op sommige bibliotheken een 501 op.

## Acquisitie-sync (`scripts/sync-acquisitie.mjs`)
Leest de Drive-map `Morgen Academy/Acquisitie` (statusmappen `1. Pending` … `5. Betaald`, plus `Archive` = overslaan) en upsert naar Supabase. Offertes mogen **`.pdf`, `.html` of `.txt`** zijn (PDF wint als er meerdere formaten liggen). Ontwerp: `docs/superpowers/specs/2026-06-16-acquisitie-dashboard-sync-design.md`.

Statusmap → wat er gebeurt:

| Map | `pipeline_status` | finance-regel (`fin_acq_<projectid>`) |
|---|---|---|
| `1. Pending` | `offerte_verzonden` | — |
| `2. Geaccepteerd` | `geaccepteerd` | **`verwacht`** |
| `3. Afgewezen` | `verloren` | — |
| `4. Gefactureerd` | `afgerond` | `gefactureerd` |
| `5. Betaald` | `afgerond` | `ontvangen` |

Eén finance-id per project, dus een map verslepen **werkt de bestaande regel bij** i.p.v. te verdubbelen.

**Wat een live-run met bestaande rijen doet:** van een project dat al bestaat wordt **alleen `pipeline_status` gepatcht** — naam, bedrag en omschrijving blijven staan. Alleen nieuwe projecten krijgen een volledige insert. Handmatige verfijningen in het dashboard overleven de sync dus.

### Vallen (allemaal een keer misgegaan)
- **Google Drive-placeholders.** File Stream houdt bestanden soms als placeholder (metadata lokaal, inhoud niet). `pdftotext` hangt dan of geeft lege output. `pdfText()` geeft `null` (≠ `''`), slaat het bestand over, en een live-run **breekt af** tenzij `--force` — anders ontstaan spookprojecten ("Onbekend: 003") of sneuvelen seed-regels. Vereist `pdftotext` (`brew install poppler`). Herstellen: in Finder rechtsklik map → *Download now*.
- **Klant bestaat al onder een ander id.** De klantnaam wordt naar een id geslugd (`GB Steel and Wood` → `cus_gb_steel_and_wood`) terwijl de klant al bestond als `cus_gb_steel` → dubbele klant én dubbel project. `main()` matcht daarom eerst op genormaliseerde naam. Bestaat een project al handmatig? Zet 'm in **`ID_ALIAS`**, anders komt er een `prj_acq_*` naast.
- **Eén klant, meerdere projecten.** De klant→project-heuristiek haakt af zodra een klant een 2e project heeft; z'n facturen vallen dan stil uit de sync (alleen een `⚑`-regel). Gebruik **`INVOICE_FOLDER_PROJECT`** om een factuurmap hard aan een project te pinnen.
- **MichielPro is een kanaal, geen klant.** Michiel haalt opdrachten binnen (Onview, PharmaPartners, PinkRoccade) en wij factureren hém. De eindklant staat in de staart van de mapnaam. Boek nooit op "MichielPro" zelf.
- **Bedragen niet raden.** Bandbreedtes ("€31.500–€33.300") of afgeleide bedragen ("50% van €2.222") parset geen enkele regex betrouwbaar → pin ze in `scripts/acquisitie-overrides.json` (op de acq-basis-id, vóór alias). Notitie-offertes met expliciete velden (`Klant:` / `Omschrijving:` / `Bedrag:`) leest `parseNote()` wel.
- **Datum-tokens botsen.** Twee mappen van dezelfde dag deelden één id-token; wie welk id kreeg hing af van de leesvolgorde van de map. Id's worden daarom in een tweede pass toegekend, met klant-suffix bij een botsing.
- **`timeout` bestaat niet op deze Mac.** Gebruik geen `timeout ...` in shell-checks (faalt stil met exit 127); `spawnSync`'s `timeout`-optie doet dat werk.
