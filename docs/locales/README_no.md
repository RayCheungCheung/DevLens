# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens er en arbeidsflytorientert utviklerleser.

Den viser samme URL samtidig i mobil- og desktoprammer, med live konsoll og nettverk, HTTP-interceptor og repeater, live designredigering, rekognoseringsrapporter, en AI-assistent og direkte overgang til editoren.

## Nøkkelfunksjoner

- Immersive workspace-temaer i fanesiden, navigasjonslinjen og sidefeltet.
- Forhåndsvisning med to viewports og synkronisert rulling.
- Tab Groups med navn, farger, dra og slipp, kontekstmeny og sammenslåing.
- Split View viser to eksisterende faner uten å laste dem på nytt.
- WImH-beskyttelse med innholdsbeskyttelse og trusseloverlay.
- Integrerte DevTools: Elements, Console, Network og Application.
- Smart omnibox med historikk, bokmerker, trafikk og fullføring.
- Workspace- og profilisolering med separate Electron-partitions.

## Teknistakk

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Kom i gang

Kjør disse kommandoene fra `outputs/devlens`:

| Skript | Beskrivelse |
| --- | --- |
| `npm install` | Installer avhengigheter |
| `npm run dev` | Start Vite og Electron med HMR |
| `npm run build` | Sjekk typer og bygg out/ |
| `npm run start` | Kjør den bygde appen |
| `npm run typecheck` | Kjør tsc --noEmit |

## Tastatursnarveier

| Handling | Snarvei |
| --- | --- |
| Ny fane | `Ctrl+T` |
| Lukk fane | `Ctrl+W` |
| Last siden på nytt | `Ctrl+R` |
| Finn på siden | `Ctrl+F` |
| Åpne innstillinger | `Ctrl+,` |
| Ny privat fane | `Ctrl+Shift+P` |
| Shell-DevTools | `F12` |
| Elements-panelet | `Ctrl+Shift+I` |
| Console-panelet | `Ctrl+Shift+J` |
| Network-panelet | `Ctrl+Shift+E` |
| Sidefelt | `Ctrl+Shift+B` |
| Ghost-modus | `Ctrl+Shift+G` |
| WImH-beskyttelse | `Ctrl+Shift+H` |
| Sist brukte fane | `Ctrl+Tab` |

## Lisens

Utgitt under [MIT-lisensen](../../LICENSE).

## Bidra

Issues og pull requests er velkomne. Kjør `npm run typecheck` før du sender endringer.

