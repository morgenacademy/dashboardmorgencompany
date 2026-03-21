# AI Company Dashboard

Een modulaire interne stuurtool voor een AI-bedrijf waarmee je kunt sturen op **omzet, uren, kwaliteit, klantwaarde en productperformance** vanuit twee primaire ingangen: **klantniveau** en **productniveau**.

## Waarom deze stack?

Deze eerste versie kiest bewust voor een **dependency-light, lokaal direct draaibare webapp**:

- **Native ES modules + vanilla JS** voor snelle start, lage complexiteit en maximale controle.
- **Gescheiden domeinlaag, datalaag en presentatielaag** zodat latere migratie naar een API/backend eenvoudig blijft.
- **LocalStorage als pragmatische lokale datastore** voor directe bruikbaarheid zonder integraties.
- **CSV/JSON ingestieflow** als startpunt voor handmatige invoer en latere uitbreiding naar externe bronnen.

Dit is production-minded opgezet qua structuur en domeinmodellering, maar zonder afhankelijk te zijn van package registries of een zware runtime.

## Starten

Kopieer en plak dit (er zijn geen externe dependencies nodig):

```bash
npm start
```

Open daarna:

- lokaal: `http://localhost:4173`
- health check: `http://localhost:4173/health`

Werk je in een remote workspace of container, gebruik dan de **port preview / port forwarding** van je omgeving voor poort `4173`.

## Tests

```bash
npm test
npm run lint
```

## Hoofdfunctionaliteit

- Management overview met topline KPI's, trends, platform breakdown en signalen.
- Klantoverzicht + klantdetail met omzet, uren, kwaliteit, repeat behaviour en health score.
- Productoverzicht + productdetail met schaalbaarheids- en probleemsignalen.
- Delivery/auditlaag voor controle op transactieniveau.
- Quality monitor waarin kwaliteit en commerciële performance samenkomen.
- Admin/invoerlaag voor:
  - handmatige JSON-records;
  - CSV-import per entiteit;
  - reset naar seeddata.

## Datamodel

Het systeem modelleert alle commerciële proposities uniform als **producten**:

### Entiteiten

- `customers`
  - klantkaart, type, industrie, status, account owner.
- `products`
  - uniforme propositiestructuur over Academy / Technology / Company.
  - velden voor platform, categorie, subcategorie, pricing model en commerciële vlag.
- `deliveries`
  - elke commerciële afname / levering met datum, omzet, directe kosten en notities.
- `effortLogs`
  - lightweight urenregistratie per levering/klant/product.
- `reviews`
  - kwaliteitsmetingen per levering, inclusief reviewscore, NPS en recommendation score.
- `users`
  - owners / account leads.
- `metricConfig`
  - configureerbare health weights en business thresholds.

### Waarom meerdere fact-achtige tabellen?

Omzet, effort en kwaliteit zitten **niet** in één tabel geperst. In plaats daarvan:

- `deliveries` is de commerciële kernfact voor omzet.
- `effortLogs` hangt aan deliveries voor effort-analyse.
- `reviews` hangt aan deliveries voor zuivere kwaliteitsanalyse.

Dat is analytisch correcter en schaalbaarder, omdat:

- niet elke levering direct een review hoeft te hebben;
- uren apart en lightweight gelogd kunnen worden;
- latere koppelingen met ERP, projecttools of surveytools eenvoudiger blijven.

## KPI-model

De app berekent onder andere:

- totale omzet
- omzet per periode
- aantal klanten
- aantal afnames
- gemiddelde dealwaarde
- totale uren
- gemiddelde uren per levering
- omzet per uur
- uren per euro omzet
- contribution en contribution margin
- reviewgemiddelde
- NPS
- aantal reviews
- repeat rate
- omzet per klant
- lifetime value per klant
- trends over tijd
- top performers en underperformers

## Health scores

### Customer health score

Een uitlegbare samengestelde score op basis van:

- omzet
- kwaliteit
- repeat behaviour
- effort-efficiëntie
- trendrichting

### Product health score

Dezelfde logica wordt gebruikt voor proposities, zodat je kunt sturen op:

- opschalen
- verbeteren
- productizen / standaardiseren
- monitoren
- stoppen

De wegingen en thresholds staan centraal in `metricConfig` en zijn eenvoudig aanpasbaar.

## Signalen / business rules

De app ondersteunt onder meer:

- High revenue / low satisfaction
- Low revenue / high satisfaction
- High hours / high satisfaction
- Low satisfaction / high hours
- Best revenue per hour
- At-risk customer / proposition
- Expansion candidate

## Ingestion-strategie

### Nu

- Seeddata voor directe evaluatie.
- Handmatige invoer via admin-flow.
- CSV-import per entiteit.

### Later

De huidige repository- en domeinscheiding maakt uitbreiding logisch naar:

- CRM-koppelingen voor klanten en deals;
- finance/backoffice voor omzet en facturatie;
- project- of delivery-tools voor uren;
- survey tooling voor reviews / NPS;
- target- en forecastmodules.

## Structuur

```txt
.
├── index.html
├── server.js
├── src
│   ├── app.js              # routing, rendering en page-compositie
│   ├── main.js             # bootstrapping
│   ├── styles.css          # rustige zakelijke UI
│   ├── data
│   │   ├── seed.js         # realistische seeddata en metric-config
│   │   └── store.js        # lokale datastore en CRUD/import helpers
│   ├── domain
│   │   ├── metrics.js      # KPI-berekeningen, aggregaties en health logic
│   │   └── validation.js   # entity-definities, CSV parsing en validatie
│   ├── tests
│   │   └── metrics.test.js # regressietests voor kernberekeningen
│   └── ui
│       └── charts.js       # eenvoudige SVG charts zonder externe libs
└── package.json
```

## Nieuwe producten toevoegen

Voeg een record toe aan `products` met:

- `name`
- `platform`
- `category`
- `subcategory`
- `status`
- `isCommercial`
- `pricingModel`
- `defaultInternalHourlyCost`

Zolang een levering naar dat product verwijst via `productId`, werkt de rest van het dashboard automatisch mee zonder kernwijzigingen.

## Nieuwe metrics toevoegen

1. Voeg de berekening toe in `src/domain/metrics.js`.
2. Voeg de metric toe aan entity-overview of page cards in `src/app.js`.
3. Voeg waar relevant een test toe in `src/tests/metrics.test.js`.

## Aannames

- Alleen commerciële producten tellen standaard mee in dashboards.
- Niet-commercieel werk kan wel gemodelleerd worden via `isCommercial: false`.
- Reviews horen idealiter bij een afgeronde delivery.
- Urenregistratie is bewust lightweight, gericht op stuurinformatie en niet op timesheet-verantwoording.
- Contribution gebruikt directe kosten + interne uurkostbenadering.

## Volgende logische uitbreidingen

- Targets / OKR-laag
- Forecasting en pipeline views
- Role-based access
- API-laag bovenop de huidige repositories
- Persistent database (bijv. Postgres/SQLite) met hetzelfde domeinmodel
