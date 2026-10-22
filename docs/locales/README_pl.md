# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens to przeglądarka dla programistów skoncentrowana na przepływie pracy.

Wyświetla ten sam adres URL jednocześnie w ramkach mobilnej i desktopowej, oferuje konsolę i sieć w czasie rzeczywistym, interceptor i repeater HTTP, edycję wyglądu, raporty rozpoznania, asystenta AI i bezpośrednie przekazanie do edytora.

## Kluczowe funkcje

- Immersyjne motywy workspace na pasku kart, nawigacji i panelu bocznym.
- Podgląd w dwóch viewportach z synchronizacją przewijania.
- Tab Groups z nazwami, kolorami, przeciąganiem, menu kontekstowym i zwijaniem.
- Split View pokazuje dwie istniejące karty bez ich ponownego ładowania.
- Ochrona WImH z ochroną zawartości i nakładką zagrożeń.
- Zintegrowane DevTools: Elements, Console, Network i Application.
- Inteligentny omnibox z historią, zakładkami, ruchem i uzupełnianiem.
- Izolacja workspace i profilu za pomocą partycji Electron.

## Stack technologiczny

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Szybki start

Uruchom te polecenia w katalogu `outputs/devlens`:

| Skrypt | Opis |
| --- | --- |
| `npm install` | Instalacja zależności |
| `npm run dev` | Start Vite i Electron z HMR |
| `npm run build` | Sprawdzenie typów i budowanie out/ |
| `npm run start` | Uruchomienie zbudowanej aplikacji |
| `npm run typecheck` | Uruchomienie tsc --noEmit |

## Skróty klawiszowe

| Akcja | Skrót |
| --- | --- |
| Nowa karta | `Ctrl+T` |
| Zamknij kartę | `Ctrl+W` |
| Odśwież stronę | `Ctrl+R` |
| Znajdź na stronie | `Ctrl+F` |
| Otwórz ustawienia | `Ctrl+,` |
| Nowa karta prywatna | `Ctrl+Shift+P` |
| DevTools powłoki | `F12` |
| Panel Elements | `Ctrl+Shift+I` |
| Panel Console | `Ctrl+Shift+J` |
| Panel Network | `Ctrl+Shift+E` |
| Panel boczny | `Ctrl+Shift+B` |
| Tryb Ghost | `Ctrl+Shift+G` |
| Ochrona WImH | `Ctrl+Shift+H` |
| Ostatnio użyta karta | `Ctrl+Tab` |

## Licencja

Projekt wydano na [licencji MIT](../../LICENSE).

## Wkład

Zgłoszenia i pull requesty są mile widziane. Przed wysłaniem zmian uruchom `npm run typecheck`.

