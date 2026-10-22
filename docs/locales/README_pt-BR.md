# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

O DevLens é um navegador para desenvolvedores centrado no fluxo de trabalho.

Ele exibe a mesma URL simultaneamente em molduras mobile e desktop, com console e rede em tempo real, interceptor e repeater HTTP, edição de design, relatórios de reconhecimento, assistente de IA e transferência direta para o editor.

## Recursos principais

- Temas imersivos de workspace na barra de abas, navegação e barra lateral.
- Visualização de duplo viewport com sincronização de rolagem.
- Tab Groups com nomes, cores, arrastar e soltar, menu de contexto e recolhimento.
- Split View para exibir duas abas existentes sem recarregá-las.
- Proteção WImH com proteção de conteúdo e overlay de ameaças.
- DevTools integrado: Elements, Console, Network e Application.
- Omnibox inteligente com histórico, favoritos, tráfego e conclusão.
- Isolamento de workspace e perfil com partitions do Electron.

## Stack tecnológico

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Primeiros passos

Execute estes comandos em `outputs/devlens`:

| Script | Descrição |
| --- | --- |
| `npm install` | Instalar dependências |
| `npm run dev` | Iniciar Vite e Electron com HMR |
| `npm run build` | Verificar tipos e construir out/ |
| `npm run start` | Executar o aplicativo construído |
| `npm run typecheck` | Executar tsc --noEmit |

## Atalhos de teclado

| Ação | Atalho |
| --- | --- |
| Nova aba | `Ctrl+T` |
| Fechar aba | `Ctrl+W` |
| Recarregar página | `Ctrl+R` |
| Localizar na página | `Ctrl+F` |
| Abrir configurações | `Ctrl+,` |
| Nova aba privada | `Ctrl+Shift+P` |
| DevTools do shell | `F12` |
| Painel Elements | `Ctrl+Shift+I` |
| Painel Console | `Ctrl+Shift+J` |
| Painel Network | `Ctrl+Shift+E` |
| Barra lateral | `Ctrl+Shift+B` |
| Modo Ghost | `Ctrl+Shift+G` |
| Proteção WImH | `Ctrl+Shift+H` |
| Aba mais recente | `Ctrl+Tab` |

## Licença

Publicado sob a [Licença MIT](../../LICENSE).

## Contribuir

Issues e pull requests são bem-vindos. Execute `npm run typecheck` antes de enviar alterações.

