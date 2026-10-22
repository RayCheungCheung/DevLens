# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens ist ein workflow-orientierter Entwickler-Browser.

Er zeigt dieselbe URL gleichzeitig in einem mobilen und einem Desktop-Rahmen an und bietet eine Live-Konsole und Netzwerkansicht, HTTP-Interceptor und Repeater, Live-Design-Änderungen, Recon-Berichte, einen KI-Assistenten sowie einen Klick-Übergang zum Editor.

## Funktionen

- Immersive Workspace-Themes: Tab-Leiste, Navigationsleiste und Sidebar nehmen die Akzentfarbe der Workspace-Themes auf.
- Dual-Viewport-Vorschau: Dieselbe Seite gleichzeitig in Mobile- und Desktop-Rahmen mit Scroll-Synchronisierung.
- Tab Groups: Tabs nach Namen und Farbe sortieren, per Drag-and-Drop oder Kontextmenü zuordnen, falten und wiederherstellen.
- Split View: Zwei vorhandene Tabs nebeneinander oder übereinander anzeigen, ohne die Seiten neu zu laden.
- WImH-Schutz: Content-Protection, Clipboard-Scrubbing, Warn-Overlay und Erkennung ungewöhnlicher Eingaben.
- DevTools-Integration: Elements, Console, Network, Application und Recon-Berichte.
- Smarte Omnibox: Adressen, Suchen, Befehle, Verlauf/Lesezeichen/Traffic-Vorschläge und Inline-Vervollständigung.
- Workspace- und Profil-Isolation: getrennte Electron-Partitions, Speicher, Verlauf und Tabs.

## Technologie-Stack

- Electron 44
- Vite 7
- React 19
- TypeScript (Strict Mode)
- Tailwind CSS 4

## Erste Schritte

Führen Sie die folgenden Befehle im Verzeichnis `outputs/devlens` aus:

| Skript | Beschreibung |
| --- | --- |
| `npm install` | Abhängigkeiten installieren |
| `npm run dev` | Vite-Dev-Server, Electron und HMR starten |
| `npm run build` | Typen prüfen und out/ bauen |
| `npm run start` | Die gebaute App in out/ ausführen |
| `npm run typecheck` | tsc --noEmit für main, preload und renderer ausführen |

## Tastenkürzel

| Aktion | Tastenkürzel |
| --- | --- |
| Neuer Tab | `Ctrl+T` |
| Tab schließen | `Ctrl+W` |
| Seite neu laden | `Ctrl+R` |
| Auf der Seite suchen | `Ctrl+F` |
| Einstellungen öffnen | `Ctrl+,` |
| Neuer privater Tab | `Ctrl+Shift+P` |
| Shell-DevTools öffnen | `F12` |
| Elements-Panel öffnen | `Ctrl+Shift+I` |
| Console-Panel öffnen | `Ctrl+Shift+J` |
| Network-Panel öffnen | `Ctrl+Shift+E` |
| Sidebar umschalten | `Ctrl+Shift+B` |
| Ghost-Modus umschalten | `Ctrl+Shift+G` |
| WImH-Schutz umschalten | `Ctrl+Shift+H` |
| Zuletzt verwendeten Tab aktivieren | `Ctrl+Tab` |

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](../../LICENSE).

## Mitwirken

Issues und Pull Requests sind willkommen. Bitte bewahren Sie den TypeScript-Strict-Modus und führen Sie vor dem Einreichen `npm run typecheck` und die relevanten Verifikationsskripte aus.

