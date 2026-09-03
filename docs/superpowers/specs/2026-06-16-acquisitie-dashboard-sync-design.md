# Acquisitie-map → dashboard sync

**Datum:** 2026-06-16
**Branch:** cockpit
**Status:** ontwerp goedgekeurd, klaar voor implementatieplan

> **Update september 2026:** de acquisitie-map is verhuisd van Google Drive naar Teams
> (SharePoint, lokaal gesynct via OneDrive) en heet daar `Marketing en Sales/Acquisitie`.
> Waar dit document "Google Drive" schrijft, lees "de acquisitie-map". Het actuele pad
> staat in `scripts/sync-acquisitie.mjs` (`ACQ_DIR_TEAMS`). De rest van het ontwerp
> verandert niet: mapstructuur, statusmappen en dataflow zijn identiek.

## Probleem

Het dashboard heeft de offerte-pipeline al (Supabase `projects`), maar wordt niet
bijgehouden: laatste project dateert van 4 mei 2026. Alle offertes sindsdien leven
alleen in de Google Drive-map `Morgen Academy/Acquisitie`. Oorzaak = dubbel
bijhouden: het team werkt in de map, het dashboard vraagt losse handmatige invoer →
loopt achter → wordt niet gebruikt.

De map ís al een nette pipeline: **submap = status**, **mapnaam/bestandsnaam =
`JJMMDD[nn] Klant Beschrijving`**. Dat is genoeg om het dashboard automatisch te vullen.

## Doel

De map blijft de werkplek en de bron van waarheid. Een lokaal sync-script leest de
map en schrijft naar Supabase, waar het dashboard al uit leest. Het team verandert
niets aan zijn werkwijze: een PDF in de juiste statusmap = het dashboard loopt mee.

## Niet-doelen (v1)

- Geen klikbare Drive-links in het dashboard (vereist Drive-API + file-IDs) — later.
- Geen aparte modellering van maandelijkse bedragen; v1 pakt het eenmalige Totaal.
- Geen volautomatische AI/LLM-parsing van PDF's; deterministisch + eenmalige
  handmatige controle bij de backfill.
- Geen schema-wijziging in Supabase.

## Architectuur & dataflow

```
Acquisitie-map (lokaal, Google Drive)
        │  node scripts/sync-acquisitie.mjs
        ▼
Supabase (projects + customers)  ◀── bestaande bron voor het dashboard
        ▲
        │  dashboard leest (store.js)
Dashboard: bestaande Overview/Projecten + nieuw #/acquisitie-bord
```

Het script draait lokaal (de map is een lokale mount; het dashboard op Netlify kan
er niet bij). Schrijven naar Supabase gebruikt dezelfde anon-key als de dashboard-app
(upsert werkt al via `store.js`).

## Mapping-regels

**Statusmap → `pipeline_status`:**

| Statusmap | pipeline_status | finance (income) |
|---|---|---|
| `1. Pending` | `offerte_verzonden` | — |
| `2. Geaccepteerd` | `geaccepteerd` | — |
| `3. Afgewezen` | `verloren` | — |
| `4. Gefactureerd` | `afgerond` | factuurregel `gefactureerd` |
| `5. Betaald` | `afgerond` | factuurregel `ontvangen` |
| `Archive` | overslaan | — |

Voor niet-gealiaste acq-offertes in `4.`/`5.` schrijft de sync een
`finance_entries`-regel (income) met een deterministische id `fin_acq_<projectid>`,
zodat het bord (Gefactureerd/Betaald) én de Finance-pagina over de hele levensloop
kloppen. Gealiaste/legacy projecten beheren hun finance zelf en worden overgeslagen
(geen dubbeltelling).

**Mapconventie:** één offerte = eigen submap `JJMMDD Klant — Titel`, met de
offerte-PDF (+ bron/factuur) erin. Granulariteit volgt daarmee de map: één regel per **offerte-PDF**. Niet-offertes worden genegeerd:
`.pages`, `.docx`, `.zip`, en bestanden met `Invoice` in de naam.

**Bestandsnaam → velden:** uit `JJMMDD[nn] Klant - Beschrijving.pdf` worden datum,
klant en titel afgeleid. Wink&See en SoloSolis zijn aparte klanten, ook al zitten ze
in één map.

**Identiteit (idempotent):** elke offerte krijgt een deterministische `id`, afgeleid
van het offertenummer of een slug van `JJMMDD-klant-beschrijving`
(bijv. `prj_acq_2607001`). De id staat los van de statusmap, zodat verplaatsen tussen
mappen alleen de status wijzigt. Heruitvoeren = upsert (bijwerken), nooit dupliceren.

**Bedragen:** het script pakt de **"Totaal"-regel** uit de PDF (`pdftotext`) als
`forecast_amount` (eenmalig, excl. btw). Lukt dat niet betrouwbaar, dan blijft het
bedrag leeg en wordt de regel gevlagd in de samenvatting. Bij de eenmalige backfill
worden de bedragen handmatig geverifieerd uit de PDF's.

**Klant automatisch aanmaken:** ontbreekt een klant (zoals Wink&See), dan maakt het
script een `customers`-record aan.

**Defaults:** `owner = Harmen`, `service_label`/`product_type` = best-effort uit de
beschrijving of `other`, `lead_source = netwerk`.

## Sync-script — `scripts/sync-acquisitie.mjs`

Gedrag:
1. Loop over de 4 statusmappen, lees per submap de offerte-PDF's.
2. Bouw per PDF een offerte-record (id, klant, titel, datum, status, bedrag).
3. Maak ontbrekende klanten aan.
4. Upsert de records naar `projects` (idempotent op `id`).
5. Print een samenvatting: aangemaakt / bijgewerkt / overgeslagen / te controleren.

Veiligheid: het script verwijdert nooit projecten. Offertes die uit de map verdwijnen
blijven in het dashboard staan (handmatig op te ruimen), zodat een per ongeluk
verplaatst bestand geen data wist.

## Acquisitie-bord — `#/acquisitie`

Nieuwe route in `app.js`, 6 kolommen: **Lead · Pending · Afgewezen · Geaccepteerd ·
Gefactureerd · Betaald**. Per kaart: klant, titel, bedrag.

- **Lead / Pending / Afgewezen / Geaccepteerd** zijn pipeline-gedreven (offerte-waarde):
  verkennen/1e_gesprek → Lead (offerte te maken); offerte_verzonden → Pending;
  verloren → Afgewezen; gewonnen-maar-nog-niet-gefactureerd → Geaccepteerd.
- **Gefactureerd / Betaald** komen uit `finance_entries` (income, payment_status
  `gefactureerd` resp. `ontvangen`), zodat de totalen **exact matchen met de
  Finance-pagina**. Een project kan deels gefactureerd én deels betaald zijn → dan
  staat het in beide kolommen met het betreffende bedrag.

## Backfill (eenmalig, nu)

De huidige map bevat onder meer: Tilburg Voorlopersprogramma (pending), 4× SoloSolis/
Wink&See (pending), Tilburg Keynote OR (geaccepteerd), SoloSolis afgewezen, SoloSolis
Vertaling (gefactureerd). Deze worden via het script geladen, met handmatig
geverifieerde bedragen, zodat het dashboard vandaag klopt.

## Onderhoud / draaien

- Handmatig: `node scripts/sync-acquisitie.mjs`.
- Optioneel later: dagelijkse launchd-job, of "Claude, sync acquisitie".

## Risico's & mitigatie

- **Rommelige bestandsnamen** → heuristiek + vlaggen i.p.v. fout gokken; lichte
  naamconventie voor de toekomst.
- **Bedrag verkeerd geparset** (eenmalig vs maandelijks vs korting) → ankeren op
  "Totaal"-regel; backfill handmatig geverifieerd.
- **Dubbele records** → deterministische id op offerte, niet op pad.

## Acceptatiecriteria

1. `node scripts/sync-acquisitie.mjs` laadt alle huidige offertes correct in Supabase,
   per PDF, met juiste status en klant.
2. Tweede run maakt geen dubbels (idempotent).
3. Het `#/acquisitie`-bord toont de 4 kolommen met de offertes en bedragen.
4. Wink&See bestaat als aparte klant.
5. Het dashboard weerspiegelt de map zonder handmatige invoer.
