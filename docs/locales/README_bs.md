# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens je preglednik za programere usmjeren na radni tok.

Prikazuje isti URL istovremeno u mobilnom i desktop okviru, nudi konzolu i mrežu u stvarnom vremenu, HTTP presretač i repeater, izmjenu dizajna, izvještaje o prepoznavanju, AI pomoćnika i direktan prelaz u editor.

## Ključne funkcije

- Imersivne workspace teme na traci kartica, navigaciji i bočnoj traci.
- Pregled s dva viewporta uz sinhronizaciju pomjeranja.
- Tab Groups s imenima, bojama, povlačenjem, kontekstnim menijem i sažimanjem.
- Split View prikazuje dvije postojeće kartice bez ponovnog učitavanja.
- WImH zaštita sa zaštitom sadržaja i upozorenjima o prijetnjama.
- Integrirani DevTools: Elements, Console, Network i Application.
- Pametni omnibox s historijom, markama, prometom i dopunjavanjem.
- Izolacija workspacea i profila putem Electron particija.

## Tehnološki stack

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Brzi početak

Pokrenite ove naredbe iz direktorija `outputs/devlens`:

| Skripta | Opis |
| --- | --- |
| `npm install` | Instalacija zavisnosti |
| `npm run dev` | Pokretanje Vite i Electron s HMR |
| `npm run build` | Provjera tipova i build out/ |
| `npm run start` | Pokretanje izgrađene aplikacije |
| `npm run typecheck` | Pokretanje tsc --noEmit |

## Prečice

| Radnja | Prečica |
| --- | --- |
| Nova kartica | `Ctrl+T` |
| Zatvori karticu | `Ctrl+W` |
| Ponovno učitaj | `Ctrl+R` |
| Traži na stranici | `Ctrl+F` |
| Otvori postavke | `Ctrl+,` |
| Nova privatna kartica | `Ctrl+Shift+P` |
| Shell DevTools | `F12` |
| Elements panel | `Ctrl+Shift+I` |
| Console panel | `Ctrl+Shift+J` |
| Network panel | `Ctrl+Shift+E` |
| Bočna traka | `Ctrl+Shift+B` |
| Ghost režim | `Ctrl+Shift+G` |
| WImH zaštita | `Ctrl+Shift+H` |
| Nedavna kartica | `Ctrl+Tab` |

## Licenca

Objavljeno pod [MIT licencom](../../LICENSE).

## Doprinos

Pitanja i pull requesti su dobrodošli. Prije slanja izmjena pokrenite `npm run typecheck`.

