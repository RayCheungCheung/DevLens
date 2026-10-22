# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens è un browser per sviluppatori orientato al flusso di lavoro.

Mostra la stessa URL in cornici mobile e desktop, con console e rete in tempo reale, intercettore e repeater HTTP, modifica del design, report di ricognizione, assistente AI e passaggio diretto all’editor.

## Funzioni principali

- Temi immersivi del workspace per schede, navigazione e barra laterale.
- Anteprima a doppio viewport con sincronizzazione dello scorrimento.
- Tab Groups con nomi, colori, trascinamento, menu contestuale e raggruppamento.
- Split View per mostrare due schede esistenti senza ricaricarle.
- Protezione WImH con content protection e overlay minacce.
- DevTools integrato: Elements, Console, Network e Application.
- Omnibox intelligente con cronologia, segnalibri, traffico e completamento.
- Isolamento per workspace e profilo con partizioni Electron.

## Stack tecnologico

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Per iniziare

Esegui questi comandi da `outputs/devlens`:

| Script | Descrizione |
| --- | --- |
| `npm install` | Installa le dipendenze |
| `npm run dev` | Avvia Vite ed Electron con HMR |
| `npm run build` | Verifica i tipi e compila out/ |
| `npm run start` | Esegue l’app compilata |
| `npm run typecheck` | Esegue tsc --noEmit |

## Scorciatoie

| Azione | Scorciatoia |
| --- | --- |
| Nuova scheda | `Ctrl+T` |
| Chiudi scheda | `Ctrl+W` |
| Ricarica pagina | `Ctrl+R` |
| Trova nella pagina | `Ctrl+F` |
| Apri impostazioni | `Ctrl+,` |
| Scheda privata | `Ctrl+Shift+P` |
| DevTools della shell | `F12` |
| Pannello Elements | `Ctrl+Shift+I` |
| Pannello Console | `Ctrl+Shift+J` |
| Pannello Network | `Ctrl+Shift+E` |
| Barra laterale | `Ctrl+Shift+B` |
| Modalità Ghost | `Ctrl+Shift+G` |
| Protezione WImH | `Ctrl+Shift+H` |
| Scheda recente | `Ctrl+Tab` |

## Licenza

Distribuito con [licenza MIT](../../LICENSE).

## Contribuire

Issue e pull request sono benvenute. Esegui `npm run typecheck` prima di inviare modifiche.

