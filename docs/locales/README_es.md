# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens es un navegador para desarrolladores centrado en el flujo de trabajo.

Previsualiza una URL al mismo tiempo en marcos móviles y de escritorio, con consola y red en vivo, interceptor y repetidor HTTP, edición de diseño, informes de reconocimiento, asistente de IA y transferencia directa al editor.

## Funciones clave

- Temas inmersivos de workspace en la barra de pestañas, navegación y barra lateral.
- Vista previa de doble viewport con sincronización de desplazamiento.
- Tab Groups con nombres, colores, arrastre, menú contextual y plegado.
- Split View para mostrar dos pestañas existentes sin recargarlas.
- Protección WImH con protección de contenido y overlay de amenazas.
- DevTools integrado: Elements, Console, Network y Application.
- Omnibox inteligente con historial, marcadores, tráfico y completion.
- Aislamiento por workspace y perfil con partitions de Electron.

## Stack tecnológico

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Primeros pasos

Ejecuta estos comandos desde `outputs/devlens`:

| Script | Descripción |
| --- | --- |
| `npm install` | Instalar dependencias |
| `npm run dev` | Iniciar Vite y Electron con HMR |
| `npm run build` | Verificar tipos y construir out/ |
| `npm run start` | Ejecutar la aplicación construida |
| `npm run typecheck` | Ejecutar tsc --noEmit |

## Atajos de teclado

| Acción | Atajo |
| --- | --- |
| Nueva pestaña | `Ctrl+T` |
| Cerrar pestaña | `Ctrl+W` |
| Recargar página | `Ctrl+R` |
| Buscar en la página | `Ctrl+F` |
| Abrir ajustes | `Ctrl+,` |
| Nueva pestaña privada | `Ctrl+Shift+P` |
| DevTools del shell | `F12` |
| Panel Elements | `Ctrl+Shift+I` |
| Panel Console | `Ctrl+Shift+J` |
| Panel Network | `Ctrl+Shift+E` |
| Alternar barra lateral | `Ctrl+Shift+B` |
| Modo Ghost | `Ctrl+Shift+G` |
| Protección WImH | `Ctrl+Shift+H` |
| Pestaña más reciente | `Ctrl+Tab` |

## Licencia

Publicado bajo la [Licencia MIT](../../LICENSE).

## Contribuir

Se aceptan issues y pull requests. Ejecuta `npm run typecheck` antes de enviar cambios.

