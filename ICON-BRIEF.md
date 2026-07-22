# Morgen Cockpit — Icon-set brief

Brief voor de ontwerper. Dit document is zelfstandig: je hebt geen verdere context nodig.

## Waar het voor is

We bouwen een interne **startpagina (cockpit)** voor Morgen — een launchpad met kaartjes die naar onze tools linken, in de Morgen-huisstijl (donker, paars, geel-groen accent). Elk kaartje krijgt een **icoon**. We hebben een samenhangende set nodig: het mag geen verzameling losse stijlen worden.

De merk-logo's (GitHub, Slack, Netlify, Google Drive, Lovable) zijn al geregeld. **Jij maakt 5 iconen** voor onze eigen apps (zie lijst onderaan).

## Stijl (verplicht)

- **Lijn-iconen (outline), niet vlak-gevuld.** Strak, geometrisch, modern. Denk Lucide / Feather-stijl.
- **Monochroom wit** (`#FFFFFF`) als basis. Eén klein **geel-groen accent** (`#D8FE56`) per icoon toegestaan om een detail te benadrukken (bijv. een piek, knooppunt of punt). Niet meer dan één accent.
- **Geen achtergrond** — transparant. De achtergrond (een donkerpaarse glass-tegel) komt vanuit de code.
- **Geen kleurverlopen, geen schaduwen, geen extra kleuren.** Alleen wit + (optioneel) het ene accent.
- Consistente lijndikte over de hele set.

## Technische specs (geldt voor elk icoon)

| Spec | Waarde |
|---|---|
| Formaat | **SVG** (vector, één set paden). Lever óók een PNG-export mee als check. |
| Aspect ratio | **1:1 vierkant** |
| Canvas | **24 × 24** teken-grid (of 64 × 64), `viewBox="0 0 24 24"` |
| Glyph-grootte | gecentreerd, **~70% van het canvas** → ca. **15% transparante marge** rondom |
| Lijndikte | **stroke 1.8** op een 24-grid (schaal mee bij groter canvas), `stroke-linecap="round"`, `stroke-linejoin="round"` |
| Kleur | lijnen wit `#FFFFFF`; optioneel één accent `#D8FE56` |
| Achtergrond | **transparant** |
| PNG-export (indien raster) | **512 × 512 px**, transparant, PNG-24 |
| Bestandsnaam | exact `icon-<key>.svg` (zie lijst), kebab-case, kleine letters |

> Belangrijk: outline-stijl met `stroke`, niet `fill`. Zo blijft het scherp en consistent met de merk-iconen.

## Aan te leveren iconen (5)

| Bestand | App | Concept-richting |
|---|---|---|
| `icon-dashboard.svg` | Dashboard (omzet/projecten/taken) | cockpit-meter of staaf+lijn-grafiek; accent op de piek/naald |
| `icon-workflow.svg` | Interne workflow (Git/samenwerken) | git-branch met knooppunten; accent op één knooppunt |
| `icon-website.svg` | Website (morgencompany.com) | globe **of** een "M"-monogram met een geel-groene punt (de Morgen-punt) |
| `icon-academy.svg` | Morgen Academy (trainingen) | toga-hoed (graduation cap) of open boek |
| `icon-portal.svg` | Klantportaal | deur/portaal **of** twee personen (klant + beheer) |

Eén icoon per app is genoeg — varianten (admin/klant) delen hetzelfde icoon.

## Do's & don'ts

**Do**
- Houd elk icoon herkenbaar op klein formaat (wordt ~52 px getoond).
- Eén duidelijke vorm per icoon; vermijd te veel details.
- Optisch uitlijnen: laat elk icoon even "zwaar" ogen (niet het ene icoon vol, het andere klein).

**Don't**
- Geen vlakke/gevulde silhouetten (op het ene accent na).
- Geen extra kleuren naast wit + `#D8FE56`.
- Geen achtergrondvlak, kader of cirkel eromheen.
- Geen tekst in het icoon (behalve eventueel de "M" bij website).

## Optionele extra art (mag, hoeft niet)

| Asset | Maat / ratio | Doel |
|---|---|---|
| `favicon.svg` | schaalbaar, leesbaar op 32 px | browser-tab |
| `apple-touch-icon.png` | **180 × 180** | icoon als bladwijzer op telefoon |
| `og-image.png` | **1200 × 630** (1.91:1) | preview bij delen (intern, lage prioriteit) |

## Aanlevering

- Map met de 5 SVG's, exact benoemd als `icon-<key>.svg`.
- Transparant, wit + (optioneel) `#D8FE56`.
- We droppen ze in de map `/assets/icons/` en ze verschijnen automatisch in de cockpit (tot die tijd staan er tijdelijke lijn-iconen).

## Palet-referentie

| Kleur | HEX |
|---|---|
| Wit (lijnen) | `#FFFFFF` |
| Accent geel-groen | `#D8FE56` |
| Paars (merk) | `#5B2D8E` |
| Donkere achtergrond | `#0C0818` |
