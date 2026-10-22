# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens er en workflow-orienteret udviklerbrowser.

Den viser samme URL i mobil- og desktoprammer med live console/netværk, HTTP-interceptor og repeater, live designredigering, rekognosceringsrapporter, AI-assistent og direkte overgang til editoren.

## Nøglefunktioner

- Immersive workspace-temaer til faner, navigation og sidebjælke.
- Dobbelt viewport-preview med synkroniseret rulning.
- Tab Groups med navne, farver, træk og slip, kontekstmenu og sammenfoldning.
- Split View viser to eksisterende faner uden at genindlæse dem.
- WImH-beskyttelse med indholdsbeskyttelse og trusselsoverlay.
- Integreret DevTools: Elements, Console, Network og Application.
- Smart omnibox med historik, bogmærker, trafik og completion.
- Workspace- og profilisolering med separate Electron-partitions.

## Teknologistack

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Kom i gang

Kør disse kommandoer fra `outputs/devlens`:

| Script | Beskrivelse |
| --- | --- |
| `npm install` | Installér afhængigheder |
| `npm run dev` | Start Vite og Electron med HMR |
| `npm run build` | Tjek typer og byg out/ |
| `npm run start` | Kør den byggede app |
| `npm run typecheck` | Kør tsc --noEmit |

## Tastaturgenveje

| Handling | Genvej |
| --- | --- |
| Ny fane | `Ctrl+T` |
| Luk fane | `Ctrl+W` |
| Genindlæs side | `Ctrl+R` |
| Søg på siden | `Ctrl+F` |
| Åbn indstillinger | `Ctrl+,` |
| Ny privat fane | `Ctrl+Shift+P` |
| Shell-DevTools | `F12` |
| Elements-panel | `Ctrl+Shift+I` |
| Console-panel | `Ctrl+Shift+J` |
| Network-panel | `Ctrl+Shift+E` |
| Sidebjælke | `Ctrl+Shift+B` |
| Ghost-tilstand | `Ctrl+Shift+G` |
| WImH-beskyttelse | `Ctrl+Shift+H` |
| Senest brugte fane | `Ctrl+Tab` |

## Licens

Udgivet under [MIT-licensen](../../LICENSE).

## Bidrag

Issues og pull requests er velkomne. Kør `npm run typecheck`, inden du sender ændringer.

