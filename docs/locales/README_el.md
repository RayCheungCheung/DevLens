# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

Το DevLens είναι ένας browser για προγραμματιστές με έμφαση στο workflow.

Εμφανίζει το ίδιο URL ταυτόχρονα σε mobile και desktop πλαίσιο, παρέχει live console/network, HTTP interceptor και repeater, live επεξεργασία design, αναφορές reconnaissance, AI assistant και άμεση μετάβαση στον editor.

## Βασικές λειτουργίες

- Immersive workspace themes στο tab strip, στο navigation bar και στο sidebar.
- Προεπισκόπηση δύο viewports με συγχρονισμό κύλισης.
- Tab Groups με ονόματα, χρώματα, drag-and-drop, context menu και folding.
- Split View εμφανίζει δύο υπάρχουσες καρτέλες χωρίς επαναφόρτωση.
- Προστασία WImH με content protection και threat overlay.
- Ενσωματωμένα DevTools: Elements, Console, Network και Application.
- Έξυπνο omnibox με ιστορικό, σελιδοδείκτες, κίνηση και συμπληρώματα.
- Απομόνωση workspace και profile μέσω ξεχωριστών Electron partitions.

## Technology stack

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Ξεκινήστε

Εκτελέστε τις παρακάτω εντολές από το `outputs/devlens`:

| Εντολή | Περιγραφή |
| --- | --- |
| `npm install` | Εγκατάσταση εξαρτήσεων |
| `npm run dev` | Εκκίνηση Vite και Electron με HMR |
| `npm run build` | Έλεγχος τύπων και build του out/ |
| `npm run start` | Εκτέλεση του build εφαρμογής |
| `npm run typecheck` | Εκτέλεση tsc --noEmit |

## Συντομεύσεις

| Ενέργεια | Συντόμευση |
| --- | --- |
| Νέα καρτέλα | `Ctrl+T` |
| Κλείσιμο καρτέλας | `Ctrl+W` |
| Επαναφόρτωση σελίδας | `Ctrl+R` |
| Εύρεση στη σελίδα | `Ctrl+F` |
| Άνοιγμα ρυθμίσεων | `Ctrl+,` |
| Νέα ιδιωτική καρτέλα | `Ctrl+Shift+P` |
| Shell DevTools | `F12` |
| Πάνελ Elements | `Ctrl+Shift+I` |
| Πάνελ Console | `Ctrl+Shift+J` |
| Πάνελ Network | `Ctrl+Shift+E` |
| Sidebar | `Ctrl+Shift+B` |
| Λειτουργία Ghost | `Ctrl+Shift+G` |
| Προστασία WImH | `Ctrl+Shift+H` |
| Πρόσφατη καρτέλα | `Ctrl+Tab` |

## Άδεια

Το έργο διατίθεται με [άδεια MIT](../../LICENSE).

## Συμβολή

Issues και pull requests είναι ευπρόσδεκτα. Εκτελέστε `npm run typecheck` πριν στείλετε αλλαγές.

