# Analyse-tab met datakwaliteit-wizard

**Datum:** 2026-07-22
**Branch:** cockpit
**Status:** ontwerp — wacht op review

## Probleem

De acquisitie-analyse (veredeling per label, sectoren, kanalen, recurring, marge)
is nu eenmalig met de hand gemaakt. Ze veroudert zodra de sync draait. Tegelijk
laat elke sync nieuwe gaten in de data ontstaan: projecten zonder `service_label`,
klanten zonder `industry`, offertes zonder bedrag, en af en toe een dubbele klant.
Die gaten maken de analyse stil onjuist — de aanleiding voor dit hele traject was
dat 57% van de projectwaarde ongelabeld was en consultancy daardoor nergens meetelde.

## Doel

Eén tab `#/analyse` die:
1. **de analyse altijd live uit Supabase toont** (Blok 1), en
2. **de gaten zichtbaar maakt en laat dichten** (Blok 2, "Ontbrekend"),

zodat de analyse klopt zonder handwerk, en de gaten worden opgeruimd op de plek
waar je ze ziet.

## Niet-doelen (YAGNI)

- Geen opgeslagen snapshots of historie — de tab is altijd live.
- Geen automatische klant-merge (zie Blok 2, check 4).
- De Overview-per-label-tegels worden **niet** herschreven. Ze meten bewust iets
  anders (zie "Twee definities" hieronder); dat verschil wordt uitgelegd, niet weggepoetst.

## Architectuur

### Nieuwe module `src/ui/analyse.js`

`app.js` is al ~2318 regels; de analyse hoort in een eigen module, net als
`src/ui/charts.js`. De module exporteert:

- `renderAnalyse(db)` → HTML-string voor de pagina (Blok 1 + Blok 2).
- `analyseModel(db)` → pure functie die alle aggregaten teruggeeft (veredeling,
  sectoren, kanalen, recurring, marge). Geen DOM, zodat het testbaar is.
- `analyseGaps(db)` → pure functie die de vier gap-lijsten teruggeeft.

Rekenlogica zit in de pure functies; `renderAnalyse` doet alleen opmaak. Dit volgt
het patroon van `finance-model.js` + `scripts/test-finance-model.mjs`.

### Integratie in `app.js` (minimaal)

- `renderNavigation` (regel ~1716): nav-item `['/analyse', 'Analyse']` toevoegen,
  na Overview.
- `renderPage` switch (regel ~1737): `case '/analyse': return renderAnalyse(db);`
- Event-afhandeling voor de wizard-knoppen sluit aan op het bestaande
  `attachEvents()`-patroon en schrijft via de bestaande `upsert`-helpers uit
  `store.js` — dezelfde weg als het projectformulier.

### Gedeelde helpers, geen tweede waarheid

De analyse hergebruikt bestaande helpers waar ze bestaan (`acquisitieBuckets`,
de finance-actual/prognose-helpers), zodat bord, Overview-tegels, Finance én deze
tab niet uiteenlopen. CLAUDE.md waarschuwt hier expliciet voor.

## Blok 1 — Analyse (live)

Alles jaargescoped op het lopende jaar, net als de rest van het dashboard. Vijf
sub-blokken:

1. **Veredeling per label** — omzet per `service_label`, gesplitst in betaald /
   gefactureerd / open offerte. Naast de vier labels een expliciete regel dat de
   Overview-tegels *toegezegd werk* tellen en dit blok *gerealiseerd + open pipeline*
   (zie "Twee definities").
2. **Sectoren** — `customers.industry`: gerealiseerd + open offerte.
3. **Kanalen** — twee dimensies: herkomst (`lead_source`) én factuurroute
   (MichielPro / Karin / Morgen direct). MichielPro wordt afgeleid uit de
   factuuromschrijving (`ilike '%michielpro%'`); dat blijft een benadering zolang
   er geen kanaalveld is, en dat wordt in het blok vermeld.
4. **Recurring** — contractueel (`pricing_model='recurring_monthly'`) versus
   feitelijke herhaalomzet (klanten met omzet in meer dan één maand). Het blok
   benoemt dat `finance_entries.recurring` onbruikbaar is zolang de sync hem op
   `one_off` hardcodeert.
5. **Marge (nieuw)** — omzet − werkelijke kosten = netto, met margepercentage.
   - Werkelijke kosten = alle expenses **behalve** de manual-monthly
     forecast-templates (`isExpenseForecastTemplate` uit `finance-model.js`).
   - **Kosten zijn overhead, niet toewijsbaar.** ~94% van de kostenregels hangt aan
     geen project, dus kosten worden niet per label of sector uitgesplitst — ze
     staan als één marge-laag tegenover de totale omzet. Dit wordt in het blok
     vermeld zodat niemand een label-marge verwacht.
   - Kostenopbouw per categorie (Software/SaaS, AI/API-credits, …) als kleine balken.
   - Netto-per-maand: omzetlijn met een kostenlijn eronder; maanden waarin netto
     negatief was worden gemarkeerd (bij de huidige data: jan en feb).

### Twee definities — expliciet maken

De Overview-per-label-tegels tellen `actual_amount + forecast_amount` over
**committed** projecten (geaccepteerd / uitvoering / afgerond). De Analyse-tab telt
**gerealiseerde omzet uit Finance + open offertes**. Beide zijn legitiem maar geven
andere getallen voor hetzelfde label (bv. IMPLEMENT is €0 op Overview want alle
implement-projecten zijn nog offerte; €42.500 open pipeline in de Analyse-tab). De
veredeling-kop noemt dit verschil in één zin, zodat het dashboard zichzelf niet
lijkt tegen te spreken.

## Blok 2 — Ontbrekend (wizard)

Een apart blok onder de analyse. Vier checks, elk met een teller en een doorloop-queue.
Schrijven gaat via de bestaande `upsert`-helpers.

### Check 1 — Label ontbreekt
Gat = `service_label = 'other' AND label_reviewed = false`. Per item: de vier
labels als keuze + knop **"hoort zo"** (bewust other). Beide acties zetten
`label_reviewed = true`.

### Check 2 — Sector ontbreekt
Gat = `customers.industry` leeg. Per item: vrij tekstveld met bestaande sectoren
als suggestie (datalist), zodat je noemers hergebruikt en geen synoniemen aanmaakt.

### Check 3 — Bedrag ontbreekt
Gat = offerte (`pipeline_status` in pending/geaccepteerd) met `value_amount = 0`.
Zo'n project verdwijnt stil uit elke omzetgrafiek. Per item: bedragveld. De sync
meldt dit al met een `⚑`-vlag; de tab maakt het klikbaar.

### Check 4 — Klant lijkt dubbel (alleen signaleren)
Twee klanten met sterk gelijkende genormaliseerde naam (zoals "Vermeulen" vs
"Trappenfabriek Vermeulen B.V."). Dit is fuzzy matching, dus af en toe een valse
melding. **De tab merget niet zelf** — de duurzame fix zit in `KNOWN_CLIENTS` /
`ID_ALIAS` van het syncscript, en een browser-app kan dat script niet aanpassen.
Een merge in de database alleen komt bij de volgende sync gewoon terug (precies de
fout van 2026-07-22). De check toont het paar en legt uit wat er in het script moet.

### Nieuwe kolom `projects.label_reviewed`

`boolean not null default false`. Onderscheidt door-mens-bevestigd van
door-sync-geraden. Sync-veilig: bestaande projecten krijgen alleen `pipeline_status`
gepatcht (regel ~690), nieuwe inserts pakken de default.

## Sync — auto-afleiden van het label

De sync leidt `service_label` af uit `product_type` bij **nieuwe** inserts
(regels ~691/693 in `sync-acquisitie.mjs`), in plaats van alles hard op `'other'`
te zetten. Bestaande projecten worden nooit op label gepatcht, dus handmatige
verfijningen overleven.

### Mapping

| `product_type`  | → `service_label` | zekerheid |
|-----------------|-------------------|-----------|
| `automatisering`| `build`           | zeker     |
| `abonnement`    | `build`           | zeker     |
| `training`      | `train`           | **onzeker — kan `inspire` zijn** |
| `strategie`     | `implement`       | redelijk  |
| `programma`     | `implement`       | redelijk  |
| `samenwerking`  | `other`           | zeker (blijft other) |
| `other`         | `other`           | —         |

### De inspire-val, en waarom `label_reviewed` het opvangt

`product_type='training'` is in de huidige data 9× `train` maar 3× `inspire`
(AgriFood MKB Boost, twee keynotes). Een harde afleiding `training→train` zou een
nieuwe keynote fout labelen — en `train` is geen gat, dus de wizard zou het nooit zien.

Daarom: **de sync zet het afgeleide label maar laat `label_reviewed = false`.** De
wizard (Check 1) toont dan twee soorten items:
- **Geen label** — `service_label='other'`, ongereviewd (hard gat).
- **Afgeleid, niet bevestigd** — `service_label≠'other'`, ongereviewd. Gepresenteerd
  als "de sync raadde `train` uit product_type — klopt dit?" met de optie om te
  wijzigen (bv. naar `inspire`). "Klopt" of een wijziging zet `label_reviewed=true`.

Zo verdwijnt geen enkel geraden label stil, en de teller kan alsnog naar nul.

## Testbaarheid

`analyseModel(db)` en `analyseGaps(db)` zijn pure functies. Nieuw testbestand
`scripts/test-analyse.mjs` (patroon: `test-finance-model.mjs`), met fixtures voor:
de twee definities (committed vs gerealiseerd+open), de marge-berekening incl.
uitsluiten van forecast-templates, en elk van de vier gap-checks (inclusief een
afgeleid-maar-onbevestigd label en een dubbele-klant-paar).

## Open punten voor implementatie

- Exacte drempel voor de fuzzy klant-match (genormaliseerde substring vs
  Levenshtein). Start: genormaliseerde naam A is substring van B, of omgekeerd.
- Volgorde binnen de wizard-queue (grootste bedrag eerst lijkt logisch).
