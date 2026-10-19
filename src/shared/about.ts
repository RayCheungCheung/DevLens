/** Public project destinations shared by the About and release notes pages. */
export const ABOUT_LINKS = {
  repository: 'https://github.com/RayCheungCheung/DevLens',
  issues: 'https://github.com/RayCheungCheung/DevLens/issues/new/choose',
  releases: 'https://github.com/RayCheungCheung/DevLens/releases',
  discord: 'https://discord.gg/devlens'
} as const

/** Bundled notes describe this source distribution, rather than inventing published releases. */
export const CURRENT_BUILD_NOTES = [
  'About DevLens & System Updates is available at devlens:settings/about.',
  'Update channel and strategy preferences are saved separately for each profile.',
  'Copy runtime diagnostics for issue reports, including Electron, Node.js, Chromium, OS and architecture.',
  'Open release history, source code and community support from the About page.'
] as const
