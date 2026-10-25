# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Houd dit bestand inhoudelijk gelijk aan `AGENTS.md`; alleen deze openingszin is tool-specifiek.

## Kern in één alinea

Buildless vanilla-JS webapp, **geen dependencies, geen bundler, geen buildstap**. Je bewerkt `src/*` en ververst de browser. De data leeft niet in de repo maar in **Supabase**; de app is een spiegel daarvan. De acquisitie-pipeline heeft een tweede bron van waarheid: een **Teams-map** (SharePoint, lokaal gesynct via OneDrive) die via een script naar Supabase wordt gesynct.

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
node scripts/test-afsluiting.mjs           # regressietest voor de Afsluiting-tab: saldo Harmen/Karin (geen netwerk nodig)
```

Let op: het `npm test`-commando uit de README bestaat **niet** (er is geen `test`-script). Gebruik de vijf gerichte regressietests hierboven. De README beschrijft bovendien een **verouderde** architectuur (LocalStorage, `src/domain/`, `seed.js`, `products`/`deliveries`/`reviews`) die niet meer bestaat — **vertrouw de code, niet de README.**

**Een UI-wijziging verifiëren.** Voor de rekenmodellen zijn er regressietests, voor de twee pagina's niet. Wat hier werkt: `npm start`, dan headless Chromium (Playwright) tegen `http://localhost:4173`, `/api/*` stubben met een vast antwoord, en de tegels echt aanklikken. Zo controleer je volgorde, flyout-inhoud, hrefs en JS-fouten zonder Netlify of Supabase nodig te hebben.

## Operationele regels (belangrijk)

- **Merge zelf NIET naar `main`.** Elke merge naar main triggert een betaalde Netlify-deploy van morgendashboard.netlify.app. Werk op een feature-branch (`cockpit`, of de `claude/*`-branch die je is toegewezen), commit en push daar, en laat het mergen aan de gebruiker: die doet dat via een PR wanneer hij er klaar voor is. Let op dat `cockpit` en `main` uit elkaar kunnen lopen; controleer bij het starten welke van de twee jouw vertrekpunt is.
- **Data zit in Supabase, niet in de repo.** Handmatige datacorrecties gaan via de Supabase MCP (`execute_sql`, project ref `jeqvjtnxgxpjviwhjmzr`), niet via codewijzigingen. RLS staat anon lezen/schrijven toe.
- **De acquisitie-map is leidend voor de acquisitie-pipeline.** Statusverschuivingen (offerte → geaccepteerd → gefactureerd → betaald) doe je door bestanden te verplaatsen in de map en te syncen, niet door los in het dashboard te typen.
- **Draai de sync altijd eerst met `--dry` en lees de uitvoer** voor je live gaat. Hij raakt echt geld: hij schrijft finance-regels en kan seed-regels vervangen. Bij twijfel over een bedrag: pinnen in de overrides, niet gokken.

## Architectuur

### Twee voordeuren, één statische site
- `index.html` — de "cockpit" landingspagina, volledig self-contained (~54 KB, eigen inline CSS/JS).
- `dashboard.html` — laadt `src/main.js` → de SPA. Bereikbaar op `/dashboard`.
- `server.js` serveert alles statisch op `:4173` en spiegelt de Netlify-functions lokaal (`/api/*`). Netlify publiceert de root (`publish = "."`) zonder build; `_redirects` + `netlify.toml` regelen routing en een wachtwoord-edge-function (`gate.js`, actief als `COCKPIT_PASSWORD` gezet is).

### De cockpit-pagina (`index.html`)
Alles zit inline in dat ene bestand. Drie structuren sturen de tegelgrid aan:

- **`LINKS`** is de bron van de grid: een lijst groepen (`Dev & deploy`, `Apps`, `Beheer`, `Automatisering`) met per item `label`, `sub`, `href` en `icon`, plus optioneel `ext` (opent in een nieuw tabblad) of `flyout` (rendert een knop in plaats van een link).
- **`FLY`** is het register van flyouts: per sleutel een `title`, een `all`-link, een `fetch()` en een `row()` die één resultaat naar HTML rendert. De sleutel matcht `data-flyout` uit het `LINKS`-item. Opgehaalde data blijft per paginabezoek in `cfg.cache` staan, dus een tweede klik doet geen nieuw verzoek.
- **`ICONS`** bevat lijn-iconen als fallback. `iconBox()` probeert eerst `/assets/icons/icon-<icon>.svg` en valt bij een laadfout terug op het inline icoon, zodat een nieuwe tegel altijd iets toont.

Haal alles wat in een attribuut belandt door `escapeHtml()`, ook `href`: de Teams-deeplink heeft een `&` in de querystring en belandt via `innerHTML` in de DOM.

### De SPA (`src/app.js`)
Eén groot bestand. Hash-router (`#/`, `#/analyse`, `#/acquisitie`, `#/projecten`, `#/taken`, `#/finance`, `#/klanten`). Rendering is **template-literals**: `renderApp()` bouwt een HTML-string en zet die in `#app`, daarna `attachEvents()`. Geen framework, geen virtual DOM — na elke mutatie volledig herrenderen. `main.js` (8 regels) doet alleen bootstrap: `renderApp()` bij DOMContentLoaded + `loadAll()`.

### Datalaag (`src/data/store.js`)
Praat met Supabase via **lokaal gevendorde** `lib/vendor/supabase-js.js` (bewust géén runtime-import van esm.sh — dat brak het dashboard). Stateless: geen login, geen localStorage. Vijf tabellen:

| Tabel | cache-key in `getDatabase()` |
|---|---|
| `customers` | `customers` |
| `projects` | `projects` |
| `tasks` | `tasks` |
| `finance_entries` | **`finance`** |
| `settlements` | `settlements` (+ `settlementsError`) |

Publieke API: `loadAll()`, `getDatabase()` (sync cache), `subscribe()`, en upsert/delete-helpers per entiteit. Schrijven gaat via `upsert` (merge op `id`). `finance_entries.date` is **NOT NULL** en `source` heeft een CHECK-constraint (o.a. `invoice`/`manual`/`bank_export`, niet vrij tekst). `finance_entries.vat_amount` is het btw-deel van `amount` bij kosten (leeg = geen NL-btw). `settlements` is optioneel bij het laden: ontbreekt de tabel, dan blijft de rest werken en toont de Afsluiting-tab de fout. Schema: `docs/sql/2026-10-25-afsluiting-bv.sql`.

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

### Afsluiting voor BV (`src/ui/afsluiting.js`, route `#/afsluiting`)
Tot er een Morgen BV is (gepland per 1-1-2027) factureert en betaalt Harmen namens Morgen via Harmen van Heist B.V. en Karin via haar eigen onderneming. Deze tab laat per persoon zien wat er namens Morgen is binnengekomen en betaald, en wie per saldo hoeveel naar de ander overmaakt. Pure kern `afsluitingModel(db)`, render `renderAfsluiting(db, {escapeHtml, settlementsError})`; `app.js` levert nav-item, route en de events voor het verrekeningsformulier. Dek rekenregels af in `scripts/test-afsluiting.mjs`.

- **Rekenregel (besloten 25-10-2026).** 50/50. Netto per persoon = ontvangen omzet − kosten. Harmen is Karin `(netto Harmen − netto Karin) ÷ 2` verschuldigd (negatief = andersom), min wat al verrekend is in `settlements` (Harmen→Karin telt af, Karin→Harmen telt bij).
- **Grondslag.** Alles ex btw: omzet staat al ex btw; bij kosten gaat `vat_amount` eraf. Periode t/m 31-12-2026. Saldo op `payment_status='ontvangen'`; `gefactureerd` staat apart als open (met een tweede saldo "als alles betaald is"); `verwacht` telt niet.
- **Wie is wie.** `owner` (`Harmen`/`Karin`) bepaalt bij wie het geld binnenkwam of vanaf wie het betaald is. `entity='HvH BV'` is Harmens eigen BV-kost (iMac, sluitpost) en telt niet mee. Prognose-templates (`manual` + `monthly`) tellen niet; `manual`-regels en regels met "SCHATTING" in de omschrijving tellen wel, maar worden als geschat gemarkeerd.
- **Bedragen op de cent.** Deze tab formatteert met twee decimalen, de rest van het dashboard rondt af.
- **Geen invoer op de tab, bewust.** Verrekeningen (`settlements`) en btw-bedragen (`vat_amount`) zet Claude op verzoek rechtstreeks in Supabase; de tab is alleen-lezen. De uitkomst staat als twee vaste regels (Harmen → Karin, Karin → Harmen), alleen de richting die moet gebeuren krijgt een bedrag.

### Funnel-vocabulaire (cross-cutting, zit in `app.js`)
Ruwe `projects.pipeline_status` ≠ de buckets die de UI toont. `acquisitieBuckets(db)` vertaalt alles naar één gedeelde funnel: **Lead · Pending · Geaccepteerd · Gefactureerd · Betaald · Afgewezen**. Cruciaal:
- **Gefactureerd** en **Betaald** komen NIET uit `pipeline_status` maar uit `finance_entries` (payment_status `gefactureerd`/`ontvangen`), **jaargescoped**. Zo matchen het `#/acquisitie`-bord, de Overview-tegels en de Finance-pagina exact.
- "Volgende actie" (op Projecten/Acquisitie/detail) toont de **eerstvolgende open taak**; de handmatige `next_action` is fallback en wordt verborgen als de datum verlopen is (`nextActionHtml()` / `nextOpenTask()`).

Wijzig je één van deze plekken, wijzig ze allemaal via de gedeelde helpers — anders lopen bord, tegels en Finance uiteen.

**Geld hoort in `finance_entries`, niet alleen in `projects.forecast_amount`.** Een bedrag dat alleen als forecast op een project staat, telt nergens in Finance mee (Verwacht/Omzet lezen puur uit finance). Daarom schrijft de sync voor `2. Geaccepteerd` een `verwacht`-regel: toegezegd werk = geld dat eraan komt. Zet je zoiets handmatig neer, doe dat dan ook als finance-regel.

### Serverless (`lib/`, `netlify/`)
`lib/integrations.mjs` (AI-nieuws, Netlify-sites, Supabase-projects, SharePoint) wordt gedeeld door `server.js` (lokaal) én `netlify/functions/*.mjs` (productie), zodat `/api/*` in beide werkt.

**Een `/api/*`-integratie toevoegen raakt vijf plekken.** Sla je er één over, dan werkt het lokaal wel en op Netlify niet, of andersom:
1. `lib/integrations.mjs`: exporteer een functie die `{ ok: true, items }` of `{ ok: false, error }` teruggeeft. Nooit gooien, en schrijf een leesbare `error`: die komt letterlijk in de flyout te staan.
2. `netlify/functions/<naam>.mjs`: dunne wrapper met `statusCode`, JSON-header en `Cache-Control`.
3. `_redirects`: `/api/<naam>` naar `/.netlify/functions/<naam>`, status 200.
4. `server.js`: dezelfde functie in `apiRoutes`, zodat `npm start` zich identiek gedraagt.
5. `index.html`: een `LINKS`-item met `flyout: '<sleutel>'` plus de bijbehorende `FLY`-config (en een icoon).

Zet nieuwe gedeelde modules ook in het `lint`-script: `node --check` is de enige syntaxcontrole die deze repo heeft.

**Env-vars en cache (kostte een keer een ronde debuggen).** Netlify-functions zien een gewijzigde env-var pas na een nieuwe deploy, dus zet 'm en trigger daarna een rebuild van dezelfde commit. Daarbovenop cachet het CDN `/api/*` zolang de `Cache-Control` van de functie zegt (5 minuten bij SharePoint), en onthoudt de flyout zijn resultaat per paginabezoek. Test dus rechtstreeks met een cache-buster, `/api/<naam>?t=1`, voor je concludeert dat de code stuk is.

**SharePoint (`/api/sharepoint`).** Microsoft Graph via de client-credentials-flow: een Azure-app-registratie met application permission `Sites.Read.All` plus admin consent. Zet `MS_CLIENT_ID` en `MS_CLIENT_SECRET` als env-vars in Netlify (nooit in de client). Optioneel: `MS_TENANT_ID` (default is de Morgen-tenant, die ook in de Teams-deeplink staat), `SHAREPOINT_HOST` (default `morgencompany.sharepoint.com`) en `SHAREPOINT_SITES` (komma-lijst met sitepaden; leeg = alle sites die de app mag zien). Ontbreken de twee verplichte vars, dan geeft het endpoint netjes `ok:false` met uitleg en blijft de tegel gewoon doorlinken naar SharePoint. De flyout haalt per site de top-level items van de standaard documentbibliotheek en sorteert zelf op `lastModifiedDateTime`: `$orderby` levert op sommige bibliotheken een 501 op.

## Acquisitie-sync (`scripts/sync-acquisitie.mjs`)
Leest de Teams-map `Marketing en Sales/Acquisitie` (statusmappen `1. Pending` … `5. Betaald`, plus `Archive` = overslaan) en upsert naar Supabase. Het pad staat als `ACQ_DIR_TEAMS` in het script en is te overschrijven met de env-var `ACQ_DIR`; ontbreekt de map, dan stopt de sync met uitleg in plaats van terug te vallen op de oude Google Drive-map (die is bij de verhuizing achtergebleven en zou statussen terugdraaien). Offertes mogen **`.pdf`, `.html` of `.txt`** zijn (PDF wint als er meerdere formaten liggen). Ontwerp: `docs/superpowers/specs/2026-06-16-acquisitie-dashboard-sync-design.md`.

Statusmap → wat er gebeurt:

| Map | `pipeline_status` | finance-regel (`fin_acq_<projectid>`) |
|---|---|---|
| `1. Pending` | `offerte_verzonden` | — |
| `2. Geaccepteerd` | `geaccepteerd` | **`verwacht`** |
| `3. Afgewezen` | `verloren` | — |
| `4. Gefactureerd` | `afgerond` | `gefactureerd` |
| `5. Betaald` | `afgerond` | `ontvangen` |

Eén finance-id per project, dus een map verslepen **werkt de bestaande regel bij** i.p.v. te verdubbelen.

**Wat een live-run met bestaande rijen doet:** van een project dat al bestaat wordt **alleen `pipeline_status` gepatcht** — naam, bedrag en omschrijving blijven staan. Alleen nieuwe projecten krijgen een volledige insert. Handmatige verfijningen in het dashboard overleven de sync dus. Uitzondering op dat patchen: een project dat je handmatig op `uitvoering` hebt gezet, zet de sync niet terug naar `geaccepteerd` (`syncPipelineStatus()` in `src/label-model.js`).

### Vallen (allemaal een keer misgegaan)
- **Cloud-placeholders.** OneDrive (Files On-Demand) houdt bestanden soms als placeholder (metadata lokaal, inhoud niet), net als Google Drive File Stream vroeger. `pdftotext` hangt dan of geeft lege output. `pdfText()` geeft `null` (≠ `''`), slaat het bestand over, en een live-run **breekt af** tenzij `--force` — anders ontstaan spookprojecten ("Onbekend: 003") of sneuvelen seed-regels. Vereist `pdftotext` (`brew install poppler`). Herstellen: in Finder rechtsklik map → *Altijd behouden op dit apparaat*.
- **Klant bestaat al onder een ander id.** De klantnaam wordt naar een id geslugd (`GB Steel and Wood` → `cus_gb_steel_and_wood`) terwijl de klant al bestond als `cus_gb_steel` → dubbele klant én dubbel project. `main()` matcht daarom eerst op genormaliseerde naam. Bestaat een project al handmatig? Zet 'm in **`ID_ALIAS`**, anders komt er een `prj_acq_*` naast.
- **Eén klant, meerdere projecten.** De klant→project-heuristiek haakt af zodra een klant een 2e project heeft; z'n facturen vallen dan stil uit de sync (alleen een `⚑`-regel). Gebruik **`INVOICE_FOLDER_PROJECT`** om een factuurmap hard aan een project te pinnen.
- **MichielPro is een kanaal, geen klant.** Michiel haalt opdrachten binnen (Onview, PharmaPartners, PinkRoccade) en wij factureren hém. De eindklant staat in de staart van de mapnaam. Boek nooit op "MichielPro" zelf.
- **Bedragen niet raden.** Bandbreedtes ("€31.500–€33.300") of afgeleide bedragen ("50% van €2.222") parset geen enkele regex betrouwbaar → pin ze in `scripts/acquisitie-overrides.json` (op de acq-basis-id, vóór alias). Notitie-offertes met expliciete velden (`Klant:` / `Omschrijving:` / `Bedrag:`) leest `parseNote()` wel.
- **Datum-tokens botsen.** Twee mappen van dezelfde dag deelden één id-token; wie welk id kreeg hing af van de leesvolgorde van de map. Id's worden daarom in een tweede pass toegekend, met klant-suffix bij een botsing.
- **`timeout` bestaat niet op deze Mac.** Gebruik geen `timeout ...` in shell-checks (faalt stil met exit 127); `spawnSync`'s `timeout`-optie doet dat werk.

## Afsluiting voor BV: werkwijze met Karin
Karins kant is nog niet compleet. Haar kosten staan er nu in als vaste **geschatte** maandbedragen (`fin_karin_actual_<jjjjmm>`, € 132,31 per maand, alleen jan t/m jul 2026). Doel: vóór 31-12-2026 haar echte cijfers erin, zodat de tab `#/afsluiting` het juiste bedrag geeft. Jij (Claude) zet alles in Supabase met `execute_sql` (project `jeqvjtnxgxpjviwhjmzr`); de tab heeft bewust geen invoer. Zonder Supabase-koppeling in de sessie kun je dit niet doen: zeg dat dan meteen.

**Begin van een sessie met Karin:** open `#/afsluiting` (of reken het na met `afsluitingModel`), noem het huidige saldo en het aantal geschatte posten, en loop daarna de lijst hieronder af. Lees na elke schrijfactie terug wat er in de tabel staat voordat je zegt dat het gelukt is.

### Wat Karin aanlevert, en wat jij ermee doet
1. **Kosten die zij namens Morgen betaald heeft, vanaf de start (2025 én 2026).** Alleen Morgen-kosten, niet die van haar eigen andere werk. Per post: datum, leverancier, bedrag zoals betaald, btw-bedrag en de bon. Bonnen gaan in de OneDrive-map `Morgen intern/Admin/Finance/Crediteuren/<jaar> Q<n> Karin`, met de naamgeving `JJMMDD Leverancier EUR x,xx - factuurnr.pdf`.
   Zet elke post als `finance_entries`-regel:
   ```sql
   insert into finance_entries (id, date, type, description, amount, vat_amount, category, vendor,
     project_id, recurring, source, owner, entity, factuur_status, payment_status)
   values ('fin_exp_karin_20260312_hostnet', '2026-03-12', 'expense', 'Hostnet — hosting morgenacademy (factuur 123)',
     12.10, 2.10, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht');
   ```
   - `amount` is het betaalde bedrag; `vat_amount` is het Nederlandse btw-deel daarvan. Laat `vat_amount` leeg bij buitenlandse SaaS met verlegde btw ("reverse charge"). Staat er wel NL-btw op de bon (Anthropic voor particulieren, Hostnet, Microsoft), vul hem in.
   - `category` uit de bestaande set: `Software/SaaS`, `AI/API credits`, `Verzekering`, `Hardware`, `Juridisch`, `Overig`.
   - Kosten staan altijd op `payment_status='verwacht'`. Dat is de bestaande conventie, niet aanpassen.
   - **Is een maand compleet, verwijder dan de schattingen van die maand:** `delete from finance_entries where id like 'fin_karin_actual_%_202603';`. Laat de `fin_karin_kost_*`-regels staan: dat zijn prognose-templates (`manual` + `monthly`) en die tellen niet mee in de afsluiting.
   - Bekend en al opgenomen: Wix € 132 (26-03-2025, `fin_exp_2025_wix_1169710647`). Bekend maar nog niet opgenomen: Lovable $ 12,50 op 13-12-2025 (Mastercard 7114, bon in `Crediteuren/2025 Q4 Harmen`, naam eindigt op "(Karin)").
   - Herkennen wie betaald heeft: Harmen betaalt met Mastercard **9585** of de Rabo-rekening van Harmen van Heist B.V. Op Karins kaarten zijn eerder **7114** (Lovable) en **7476** (Anthropic) gezien.
2. **Welke van haar facturen betaald zijn, en wanneer.** 202607-021, 202607-022 en 202607-023 (juli 2026) staan nog op gefactureerd. Betaald? Verplaats de pdf in de acquisitie-map naar `5. Betaald` en draai de sync (eerst `--dry`). Zet ze niet los in Supabase.
3. **Haar omzet namens Morgen uit 2025.** Nu staan alleen Trappenfabriek Vermeulen (€ 765) en Mariette Reineke (€ 800) erin. Ontbreekt er iets, dan liefst via de acquisitie-map. Zonder pdf: een `income`-regel met `owner='Karin'`, `entity='Karin'`, `payment_status='ontvangen'` en het bedrag **ex btw**.
4. **Eerdere onderlinge betalingen** tussen Karin en Harmen, bedrag ex btw:
   ```sql
   insert into settlements (id, date, from_person, to_person, amount, description)
   values ('set_20260115_karin_harmen', '2026-01-15', 'Karin', 'Harmen', 100.00, 'omschrijving');
   ```
   Al opgenomen: `set_202503_003` (Karins factuur 202503-003, gedeelde websitekosten, € 44 ex btw, door Harmen betaald op 10-04-2025).
5. **Akkoord op de rekenregel:** 50/50 van het netto resultaat, ex btw, t/m 31-12-2026, op ontvangen geld.

### Klaar als
- Er staan geen geschatte posten meer bij Karin op de tab (de rode melding is weg).
- Alle juli-facturen hebben een definitieve status.
- Harmen en Karin zijn het eens over de lijst "Al verrekend".
- De bovenste zin op de tab is het bedrag dat overgemaakt wordt. Na die betaling voeg je hem toe als verrekening; dan staan beide regels op "—".

### Open punten aan Harmens kant
Harmens kant is per 25-10-2026 gecontroleerd tegen Rabo (MT940) en creditcard (ICS) vanaf 2025. Nog open:
- Wix Payments € 48,70 op 8-12-2025 (Stripe-uitbetaling "WIX PAYMENTS" op de BV-Rabo): onbekend waarvoor; mogelijk een testaankoop na het activeren van Wix-uitbetalingen op 9-12-2025.

Opgelost op 25-10-2026: de Stripe-uitbetalingen "MORGEN ACADEMY" van oktober 2025 (€ 291,73 netto) zijn de 4 tickets voor de AI Workshop Den Bosch van 24-10-2025 (4 × € 61,98 ex btw = € 247,92). De sync las alleen de eerste factuur uit de pdf; het bedrag is vastgezet in `acquisitie-overrides.json` (`prj_acq_251024`).

## Open vragen voor Karin
Stel deze vraag aan het begin van een sessie met Karin, en haal hem hier weg zodra hij beantwoord en verwerkt is.

- **VML: training 22 mei 2026** (`prj_vml`) staat nog op `geaccepteerd`. Factuur 202605-012 (Training Basis + Gevorderd, €1.750) is al ontvangen, dus waarschijnlijk is de training afgerond. Klopt dat? Zet het project dan op `afgerond`, met een Supabase-update, want deze status komt niet uit de acquisitie-map.
