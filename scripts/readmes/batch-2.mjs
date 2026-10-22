export default [
  {
    file: 'README_es.md',
    intro: 'DevLens es un navegador para desarrolladores centrado en el flujo de trabajo.',
    introDetail: 'Previsualiza una URL al mismo tiempo en marcos móviles y de escritorio, con consola y red en vivo, interceptor y repetidor HTTP, edición de diseño, informes de reconocimiento, asistente de IA y transferencia directa al editor.',
    features: [
      'Temas inmersivos de workspace en la barra de pestañas, navegación y barra lateral.',
      'Vista previa de doble viewport con sincronización de desplazamiento.',
      'Tab Groups con nombres, colores, arrastre, menú contextual y plegado.',
      'Split View para mostrar dos pestañas existentes sin recargarlas.',
      'Protección WImH con protección de contenido y overlay de amenazas.',
      'DevTools integrado: Elements, Console, Network y Application.',
      'Omnibox inteligente con historial, marcadores, tráfico y completion.',
      'Aislamiento por workspace y perfil con partitions de Electron.'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript (strict)', 'Tailwind CSS 4'],
    gettingStarted: 'Ejecuta estos comandos desde `outputs/devlens`:',
    scripts: [['npm install', 'Instalar dependencias'], ['npm run dev', 'Iniciar Vite y Electron con HMR'], ['npm run build', 'Verificar tipos y construir out/'], ['npm run start', 'Ejecutar la aplicación construida'], ['npm run typecheck', 'Ejecutar tsc --noEmit']],
    headings: { features: 'Funciones clave', techStack: 'Stack tecnológico', gettingStarted: 'Primeros pasos', shortcuts: 'Atajos de teclado', license: 'Licencia', contributing: 'Contribuir' },
    tableHeaders: { script: 'Script', description: 'Descripción', action: 'Acción', shortcut: 'Atajo' },
    shortcuts: [['Nueva pestaña', 'Ctrl+T'], ['Cerrar pestaña', 'Ctrl+W'], ['Recargar página', 'Ctrl+R'], ['Buscar en la página', 'Ctrl+F'], ['Abrir ajustes', 'Ctrl+,'], ['Nueva pestaña privada', 'Ctrl+Shift+P'], ['DevTools del shell', 'F12'], ['Panel Elements', 'Ctrl+Shift+I'], ['Panel Console', 'Ctrl+Shift+J'], ['Panel Network', 'Ctrl+Shift+E'], ['Alternar barra lateral', 'Ctrl+Shift+B'], ['Modo Ghost', 'Ctrl+Shift+G'], ['Protección WImH', 'Ctrl+Shift+H'], ['Pestaña más reciente', 'Ctrl+Tab']],
    license: 'Publicado bajo la [Licencia MIT](../../LICENSE).',
    contributing: 'Se aceptan issues y pull requests. Ejecuta `npm run typecheck` antes de enviar cambios.'
  },
  {
    file: 'README_fr.md',
    intro: 'DevLens est un navigateur pour développeurs orienté workflow.',
    introDetail: 'Il affiche une même URL dans des cadres mobile et bureau, avec console et réseau en direct, intercepteur et répétiteur HTTP, édition de design, rapports de reconnaissance, assistant IA et accès direct à l’éditeur.',
    features: [
      'Thèmes de workspace immersifs pour les onglets, la navigation et la barre latérale.',
      'Aperçu double viewport avec synchronisation du défilement.',
      'Tab Groups avec noms, couleurs, glisser-déposer, menu contextuel et repliage.',
      'Split View pour afficher deux onglets existants sans les recharger.',
      'Protection WImH avec protection du contenu et overlay de menaces.',
      'DevTools intégré : Elements, Console, Network et Application.',
      'Omnibox intelligente avec historique, marque-pages, trafic et complétion.',
      'Isolation par workspace et profil avec partitions Electron.'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript (strict)', 'Tailwind CSS 4'],
    gettingStarted: 'Exécutez ces commandes depuis `outputs/devlens` :',
    scripts: [['npm install', 'Installer les dépendances'], ['npm run dev', 'Démarrer Vite et Electron avec HMR'], ['npm run build', 'Vérifier les types et construire out/'], ['npm run start', 'Exécuter l’application construite'], ['npm run typecheck', 'Exécuter tsc --noEmit']],
    headings: { features: 'Fonctionnalités', techStack: 'Pile technique', gettingStarted: 'Démarrage', shortcuts: 'Raccourcis', license: 'Licence', contributing: 'Contribuer' },
    tableHeaders: { script: 'Script', description: 'Description', action: 'Action', shortcut: 'Raccourci' },
    shortcuts: [['Nouvel onglet', 'Ctrl+T'], ['Fermer l’onglet', 'Ctrl+W'], ['Recharger la page', 'Ctrl+R'], ['Rechercher dans la page', 'Ctrl+F'], ['Ouvrir les réglages', 'Ctrl+,'], ['Onglet privé', 'Ctrl+Shift+P'], ['DevTools du shell', 'F12'], ['Panneau Elements', 'Ctrl+Shift+I'], ['Panneau Console', 'Ctrl+Shift+J'], ['Panneau Network', 'Ctrl+Shift+E'], ['Barre latérale', 'Ctrl+Shift+B'], ['Mode Ghost', 'Ctrl+Shift+G'], ['Protection WImH', 'Ctrl+Shift+H'], ['Onglet récent', 'Ctrl+Tab']],
    license: 'Publié sous [licence MIT](../../LICENSE).',
    contributing: 'Issues et pull requests sont bienvenues. Exécutez `npm run typecheck` avant d’envoyer des modifications.'
  },
  {
    file: 'README_it.md',
    intro: 'DevLens è un browser per sviluppatori orientato al flusso di lavoro.',
    introDetail: 'Mostra la stessa URL in cornici mobile e desktop, con console e rete in tempo reale, intercettore e repeater HTTP, modifica del design, report di ricognizione, assistente AI e passaggio diretto all’editor.',
    features: [
      'Temi immersivi del workspace per schede, navigazione e barra laterale.',
      'Anteprima a doppio viewport con sincronizzazione dello scorrimento.',
      'Tab Groups con nomi, colori, trascinamento, menu contestuale e raggruppamento.',
      'Split View per mostrare due schede esistenti senza ricaricarle.',
      'Protezione WImH con content protection e overlay minacce.',
      'DevTools integrato: Elements, Console, Network e Application.',
      'Omnibox intelligente con cronologia, segnalibri, traffico e completamento.',
      'Isolamento per workspace e profilo con partizioni Electron.'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript (strict)', 'Tailwind CSS 4'],
    gettingStarted: 'Esegui questi comandi da `outputs/devlens`:',
    scripts: [['npm install', 'Installa le dipendenze'], ['npm run dev', 'Avvia Vite ed Electron con HMR'], ['npm run build', 'Verifica i tipi e compila out/'], ['npm run start', 'Esegue l’app compilata'], ['npm run typecheck', 'Esegue tsc --noEmit']],
    headings: { features: 'Funzioni principali', techStack: 'Stack tecnologico', gettingStarted: 'Per iniziare', shortcuts: 'Scorciatoie', license: 'Licenza', contributing: 'Contribuire' },
    tableHeaders: { script: 'Script', description: 'Descrizione', action: 'Azione', shortcut: 'Scorciatoia' },
    shortcuts: [['Nuova scheda', 'Ctrl+T'], ['Chiudi scheda', 'Ctrl+W'], ['Ricarica pagina', 'Ctrl+R'], ['Trova nella pagina', 'Ctrl+F'], ['Apri impostazioni', 'Ctrl+,'], ['Scheda privata', 'Ctrl+Shift+P'], ['DevTools della shell', 'F12'], ['Pannello Elements', 'Ctrl+Shift+I'], ['Pannello Console', 'Ctrl+Shift+J'], ['Pannello Network', 'Ctrl+Shift+E'], ['Barra laterale', 'Ctrl+Shift+B'], ['Modalità Ghost', 'Ctrl+Shift+G'], ['Protezione WImH', 'Ctrl+Shift+H'], ['Scheda recente', 'Ctrl+Tab']],
    license: 'Distribuito con [licenza MIT](../../LICENSE).',
    contributing: 'Issue e pull request sono benvenute. Esegui `npm run typecheck` prima di inviare modifiche.'
  }
]
