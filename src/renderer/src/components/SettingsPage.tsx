import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Check,
  ChevronRight,
  Compass,
  Download,
  Globe2,
  House,
  Info,
  LayoutPanelTop,
  Languages,
  Palette,
  PanelsTopLeft,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Wrench
} from 'lucide-react'
import { AI_SITES, type AiSiteId } from '@shared/ai-sites'
import type { BookmarkOptions, ProtectionState } from '@shared/types'
import {
  type AboutPreferences,
  type BrowserPreferences,
  type DeveloperPreferences,
  type SidebarTogglePosition,
  type ToolbarLayout,
  type ToolbarTools
} from '@shared/preferences'
import type { IdeOption } from '@shared/ide'
import type {
  LaunchpadActivity,
  LaunchpadPreferences,
  LaunchpadSystemState,
  LaunchpadWidgets,
  LaunchTarget,
  StartupTabMode
} from '@shared/launchpad'
import {
  resolveLaunchpadWallpaper,
  WALLPAPER_PRESETS
} from '@shared/wallpapers'
import type { OmniboxSettings } from '@shared/omnibox-settings'
import type { SettingsCategoryId } from '@shared/routes'
import type {
  ClearBrowsingDataRequest,
  ClearBrowsingDataResult,
  DnsMode,
  HistoryPolicy,
  PrivacyPreferences,
  ProfileDiskUsage,
  ShieldMode
} from '@shared/privacy'
import {
  CODE_FONTS,
  INTERFACE_FONTS,
  WORKSPACE_THEMES,
  type CodeFontId,
  type AppearancePreferences,
  type ContentThemeMode,
  type UiFontId,
  type UiDensity,
  type WorkspaceThemeId
} from '@shared/appearance'
import type {
  HardwareAccelerationMode,
  TabsPreferences
} from '@shared/tabs'
import {
  LANGUAGE_OPTIONS,
  type LanguagePreferences
} from '@shared/languages'
import {
  PROTECTION_DESCRIPTORS
} from '@shared/protection'
import { AiMark } from '@renderer/components/AiMark'
import { OmniboxSettingsContent } from '@renderer/components/OmniboxSettings'
import { AboutSettingsContent } from '@renderer/components/AboutSettings'
import { DownloadsSettingsContent } from '@renderer/components/DownloadsSettings'
import { BrowsingDataSettingsContent } from '@renderer/components/BrowsingDataSettings'
import { DefaultBrowserCard } from '@renderer/components/DefaultBrowserCard'
import { LensyMascot } from '@renderer/components/LensyMascot'
import { IdeSelect } from '@renderer/components/IdeSelect'
import type { DownloadPreferences, DownloadPreferencesPatch } from '@shared/downloads'
import { AppIconPicker, AppIconPreview } from '@renderer/components/AppIconPicker'
import { appIconDesign } from '@shared/app-icon-art'
import type { AboutInfo, UpdateChannel, UpdateStrategy } from '@shared/types'
import { ToggleSwitch as Switch } from '@renderer/components/ToggleSwitch'

interface SettingsPageProps {
  /** The category named by the tab's `devlens:settings/<category>` URL. */
  category: SettingsCategoryId
  onCategoryChange: (category: SettingsCategoryId) => void
  aiProvider: AiSiteId
  onProviderChange: (site: AiSiteId) => void
  omnibox: OmniboxSettings
  onOmnibox: (settings: OmniboxSettings) => void
  omniboxFavicons: Record<string, string | null>
  browser: BrowserPreferences
  onBrowser: (patch: Partial<BrowserPreferences>) => void
  launchpad: LaunchpadPreferences
  onLaunchpad: (patch: Partial<LaunchpadPreferences>) => void
  systemIntegration: LaunchpadSystemState
  systemIntegrationBusy: boolean
  onSetDefaultBrowser: () => void
  onLaunchAtLogin: (enabled: boolean) => void
  onChooseWallpaper: () => void
  toolbarLayout: ToolbarLayout
  onLayout: (patch: { sidebarToggle?: SidebarTogglePosition; tools?: Partial<ToolbarTools> }) => void
  bookmarkOptions: BookmarkOptions
  onBookmarkOptions: (patch: Partial<BookmarkOptions>) => void
  protection: ProtectionState
  privacy: PrivacyPreferences
  diskUsage: ProfileDiskUsage
  onShieldMode: (mode: ShieldMode) => void
  onShieldRules: (
    patch: Pick<
      PrivacyPreferences,
      'blockCrossSiteTrackers' | 'blockFingerprinters' | 'blockCryptominers' | 'sendDnt'
    >
  ) => void
  onNetworkSecurity: (patch: Pick<PrivacyPreferences, 'dnsMode' | 'httpsOnly'>) => void
  onHistoryPolicy: (policy: HistoryPolicy) => void
  onClearBrowsingDataSelected: (
    request: ClearBrowsingDataRequest
  ) => Promise<ClearBrowsingDataResult>
  onRunRetentionCleanup: () => void
  onRefreshDiskUsage: () => void
  onSiteException: (site: string, allowed: boolean) => void
  onPrivacy: (patch: Partial<PrivacyPreferences>) => void
  appearance: AppearancePreferences
  onAppearance: (patch: Partial<AppearancePreferences>) => void
  onOpenThemes: () => void
  tabsPreferences: TabsPreferences
  onTabs: (patch: Partial<TabsPreferences>) => void
  languages: LanguagePreferences
  onLanguages: (patch: Partial<LanguagePreferences>) => void
  profileAsk: boolean
  onProfileAsk: (ask: boolean) => void
  profileName: string
  developer: DeveloperPreferences
  ideOptions: IdeOption[]
  onDeveloperChange: (patch: Partial<DeveloperPreferences>) => void
  /** System and version info shown by the About page, or null while main has not answered. */
  aboutInfo: AboutInfo | null
  aboutPreferences: AboutPreferences
  downloads: DownloadPreferences
  onDownloads: (patch: DownloadPreferencesPatch) => void
  /** Called when the operator changes the update channel or strategy on the About page. */
  onAboutChange: (patch: Partial<{ updateChannel: UpdateChannel; updateStrategy: UpdateStrategy }>) => void
  /** Opens a `devlens:` or external URL as a tab, for changelog and community links. */
  onOpenAboutRoute: (url: string) => void
}

const CATEGORIES: {
  id: SettingsCategoryId
  label: string
  summary: string
  icon: typeof House
}[] = [
  { id: 'home', label: 'Launchpad', summary: 'Startup, widgets and visuals', icon: House },
  { id: 'search', label: 'Omnibox', summary: 'Engines and suggestions', icon: Search },
  { id: 'privacy', label: 'Privacy and security', summary: 'Protection and data', icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', summary: 'Toolbar, bookmarks and zoom', icon: Palette },
  { id: 'tabs', label: 'Tabs and browsing', summary: 'Bookmark behavior', icon: PanelsTopLeft },
  { id: 'downloads', label: 'Downloads & File Handlers', summary: 'Save locations and content types', icon: Download },
  { id: 'languages', label: 'Languages & Localization', summary: 'Interface, web and translation', icon: Languages },
  { id: 'developer', label: 'Developer workspace', summary: 'AI and tooling', icon: Wrench },
  { id: 'identity', label: 'Identity', summary: 'Profile and startup prompt', icon: UserRound },
  { id: 'about', label: 'About DevLens & System Updates', summary: 'Version, updates and license', icon: Info }
]

const AI_PROVIDER_TILE: Record<AiSiteId, { background: string; border: string }> = {
  gemini: { background: 'rgba(56, 189, 248, 0.11)', border: 'rgba(56, 189, 248, 0.3)' },
  deepseek: { background: 'rgba(77, 107, 254, 0.13)', border: 'rgba(77, 107, 254, 0.34)' },
  chatgpt: { background: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.28)' },
  claude: { background: 'rgba(217, 119, 87, 0.13)', border: 'rgba(217, 119, 87, 0.34)' }
}

const TOOL_ROWS: { key: keyof ToolbarTools; label: string; detail: string }[] = [
  { key: 'viewport', label: 'Viewport chip', detail: 'Show which viewport a command will reach' },
  { key: 'scrollSync', label: 'Scroll sync', detail: 'Keep the mobile and desktop panes together' },
  { key: 'openInIde', label: 'Open in VS Code', detail: 'Click-to-source hand-off' },
  { key: 'defense', label: 'WImH shield', detail: 'The extreme defense panel' }
]

const WIDGET_ROWS: { key: keyof LaunchpadWidgets; label: string; detail: string }[] = [
  { key: 'clock', label: 'Clock', detail: 'World clocks for Macao, Tokyo, London and San Francisco.' },
  { key: 'devSpotlight', label: 'Dev quote / photo', detail: 'A rotating quote with your wallpaper as the photo.' },
  { key: 'quickSnippets', label: 'Quick snippets', detail: 'A local shelf of commands you can copy in one click.' },
  { key: 'systemHealth', label: 'System health', detail: 'CPU threads, device memory and session counters.' },
  { key: 'weather', label: 'Weather', detail: 'A local weather lookup for the place below.' },
  { key: 'focusTimer', label: 'Focus timer', detail: 'A 25-minute focus and 5-minute break timer.' }
]

const ACTIVITY_ROWS: { key: keyof LaunchpadActivity; label: string; detail: string }[] = [
  { key: 'recent', label: 'Recent pages', detail: 'Show the latest pages from this profile.' },
  { key: 'bookmarks', label: 'Bookmarks', detail: 'Show saved pages as a second activity shelf.' },
  { key: 'downloads', label: 'Downloads', detail: 'Keep a downloads shelf visible on the Launchpad.' }
]

const TARGET_LABELS: Record<LaunchTarget, string> = {
  launchpad: 'Launchpad',
  blank: 'Blank Canvas',
  custom: 'Custom URL'
}

/**
 * The profile's settings centre at `devlens:settings`.
 *
 * Firefox's shape is the model: categories on the left, one focused panel on the right, and
 * controls grouped by the thing they change. Every row here writes to a live store - profile
 * preferences, the omnibox settings, protection, or bookmarks - rather than keeping a private
 * copy that would make the page look richer than the browser actually is.
 */
export function SettingsPage({
  category,
  onCategoryChange,
  aiProvider,
  onProviderChange,
  omnibox,
  onOmnibox,
  omniboxFavicons,
  browser,
  onBrowser,
  launchpad,
  onLaunchpad,
  systemIntegration,
  systemIntegrationBusy,
  onSetDefaultBrowser,
  onLaunchAtLogin,
  onChooseWallpaper,
  toolbarLayout,
  onLayout,
  bookmarkOptions,
  onBookmarkOptions,
  protection,
  privacy,
  diskUsage,
  onShieldMode,
  onShieldRules,
  onNetworkSecurity,
  onHistoryPolicy,
  onClearBrowsingDataSelected,
  onRunRetentionCleanup,
  onRefreshDiskUsage,
  onSiteException,
  onPrivacy,
  appearance,
  onAppearance,
  onOpenThemes,
  tabsPreferences,
  onTabs,
  languages,
  onLanguages,
  profileAsk,
  onProfileAsk,
  profileName,
  developer,
  ideOptions,
  onDeveloperChange,
  aboutInfo,
  aboutPreferences,
  downloads,
  onDownloads,
  onAboutChange,
  onOpenAboutRoute
}: SettingsPageProps) {
  const [filter, setFilter] = useState('')
  const [homeDraft, setHomeDraft] = useState(launchpad.customUrl)
  const [weatherDraft, setWeatherDraft] = useState(launchpad.weatherPlace)
  const [exceptionDraft, setExceptionDraft] = useState('')
  const [webLanguageDraft, setWebLanguageDraft] = useState('zh-CN')
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const selectedUiFont =
    INTERFACE_FONTS.find((font) => font.id === appearance.uiFont) ?? INTERFACE_FONTS[0]
  const selectedCodeFont = CODE_FONTS.find((font) => font.id === appearance.codeFont) ?? CODE_FONTS[0]
  const savedTabCount = launchpad.session.tabs.length
  const pinnedTabCount = launchpad.session.tabs.filter((tab) => tab.pinned).length
  const wallpaperUrl = resolveLaunchpadWallpaper(launchpad)
  const customUrlEnabled =
    launchpad.newTabTarget === 'custom' || launchpad.homeTarget === 'custom'
  const startupTabsDetail =
    launchpad.startupTabs === 'pinned'
      ? `${pinnedTabCount} pinned tab${pinnedTabCount === 1 ? '' : 's'} will open at startup.`
      : launchpad.startupTabs === 'all'
        ? `${savedTabCount} saved tab${savedTabCount === 1 ? '' : 's'} will open at startup.`
        : `${savedTabCount} saved tab${savedTabCount === 1 ? '' : 's'}; startup restore is off.`

  useEffect(() => setHomeDraft(launchpad.customUrl), [launchpad.customUrl])
  useEffect(() => setWeatherDraft(launchpad.weatherPlace), [launchpad.weatherPlace])

  const filteredCategories = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return CATEGORIES
    return CATEGORIES.filter((category) =>
      `${category.label} ${category.summary}`.toLowerCase().includes(query)
    )
  }, [filter])

  useEffect(() => {
    if (filteredCategories.some((entry) => entry.id === category)) return
    if (filteredCategories[0]) onCategoryChange(filteredCategories[0].id)
  }, [category, filteredCategories, onCategoryChange])

  const current = CATEGORIES.find((entry) => entry.id === category) ?? CATEGORIES[0]

  const commitHomepage = (): void => {
    if (!customUrlEnabled) return
    const next = homeDraft.trim()
    if (!next) {
      setHomeDraft(launchpad.customUrl)
      return
    }
    onLaunchpad({ customUrl: next })
  }

  const commitWeatherPlace = (): void => {
    const next = weatherDraft.trim()
    if (!next) {
      setWeatherDraft(launchpad.weatherPlace)
      return
    }
    onLaunchpad({ weatherPlace: next })
  }

  const addException = (): void => {
    const site = exceptionDraft.trim()
    if (!site) return
    onSiteException(site, true)
    setExceptionDraft('')
  }

  const addDevContainer = (): void => {
    const id = `container-${Date.now().toString(36)}`
    onTabs({
      containers: [
        ...tabsPreferences.containers,
        { id, label: 'New Container', color: '#7dd3fc', enabled: true }
      ]
    })
  }

  const addHotkey = (): void => {
    const id = `hotkey-${Date.now().toString(36)}`
    onTabs({
      hotkeys: [
        ...tabsPreferences.hotkeys,
        { id, label: 'Custom command', shortcut: '' }
      ]
    })
  }

  const addWebLanguage = (): void => {
    if (!webLanguageDraft || languages.webLanguages.includes(webLanguageDraft)) return
    onLanguages({ webLanguages: [...languages.webLanguages, webLanguageDraft] })
  }

  const moveWebLanguage = (index: number, direction: -1 | 1): void => {
    const target = index + direction
    if (target < 0 || target >= languages.webLanguages.length) return
    const next = [...languages.webLanguages]
    ;[next[index], next[target]] = [next[target], next[index]]
    onLanguages({ webLanguages: next })
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ink-950"
      data-testid="settings-page"
      data-settings-category={category}
    >
      <aside className="flex min-h-0 w-[clamp(264px,22vw,304px)] shrink-0 flex-col overflow-hidden border-r border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-900)_82%,transparent)]">
        <div className="shrink-0 px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]">
              <SlidersHorizontal size={19} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold text-ink-100">Settings</h1>
              <p className="truncate font-mono text-[10px] text-ink-500">
                devlens:settings/{category}
              </p>
            </div>
          </div>
          <label className="mt-5 flex h-10 items-center gap-2.5 rounded-lg border border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] px-3 focus-within:border-[var(--devlens-accent-line)]">
            <Search size={15} className="shrink-0 text-ink-500" />
            <input
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter categories"
              aria-label="Filter settings categories"
              data-testid="settings-filter"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-ink-200 outline-none placeholder:text-ink-600"
            />
          </label>
        </div>

        <nav aria-label="Settings categories" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-4">
          {filteredCategories.map((entry) => {
            const Icon = entry.icon
            const selected = entry.id === category
            return (
              <button
                key={entry.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                data-testid={`settings-category-${entry.id}`}
                onClick={() => onCategoryChange(entry.id)}
                className={[
                  'mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'bg-[var(--devlens-accent-soft)] text-ink-100'
                    : 'text-ink-300 hover:bg-white/[0.035] hover:text-ink-100'
                ].join(' ')}
              >
                <Icon
                  size={17}
                  className={selected ? 'shrink-0 text-[var(--devlens-accent)]' : 'shrink-0 text-ink-500'}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-5">{entry.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-ink-500">{entry.summary}</span>
                </span>
                {selected && <ChevronRight size={14} className="shrink-0 text-ink-500" />}
              </button>
            )
          })}
          {filteredCategories.length === 0 && (
            <p className="px-2.5 py-4 text-[11px] leading-5 text-ink-500">No category matches that filter.</p>
          )}
        </nav>

        <div className="shrink-0 border-t border-[var(--devlens-hairline)] px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-400/15 font-mono text-[11px] uppercase text-teal-100">
              {profileName.slice(0, 1) || 'U'}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] text-ink-200">{profileName}</span>
              <span className="mt-0.5 block text-[10px] text-ink-500">Profile settings are isolated</span>
            </span>
          </div>
        </div>
      </aside>

      <div data-testid="settings-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto w-full max-w-[980px] px-10 py-9">
          <header className="mb-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--devlens-accent)]">
              {current.summary}
            </p>
            <h2 className="mt-1.5 text-[27px] font-semibold text-ink-100">{category === 'downloads' ? 'DevLens Downloads & File Handlers' : current.label}</h2>
          </header>

          {category === 'home' && (
            <div className="flex flex-col gap-4">
              <DefaultBrowserCard
                isDefaultBrowser={systemIntegration.isDefaultBrowser}
                busy={systemIntegrationBusy}
                onSetDefault={onSetDefaultBrowser}
              />

              <SettingsCard
                title="Startup"
                detail="Choose what DevLens restores and checks when it opens."
              >
                <div className="divide-y divide-white/[0.05]">
                  <SettingRow
                    label="Open previous windows and tabs"
                    detail={startupTabsDetail}
                  >
                    <select
                      data-testid="launchpad-startup-tabs"
                      aria-label="Open previous windows and tabs"
                      value={launchpad.startupTabs}
                      onChange={(event) =>
                        onLaunchpad({ startupTabs: event.target.value as StartupTabMode })
                      }
                      className="h-8 rounded-md border border-[var(--devlens-hairline)] bg-ink-900 px-2.5 text-[10px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
                    >
                      <option value="none">Don't restore tabs</option>
                      <option value="pinned">Pinned tabs only</option>
                      <option value="all">All previous tabs</option>
                    </select>
                  </SettingRow>
                  <SettingRow
                    label="Open DevLens automatically when your computer starts up"
                    detail="Start DevLens when you sign in to this computer."
                  >
                    <Switch
                      checked={systemIntegration.launchAtLogin}
                      disabled={systemIntegrationBusy}
                      testId="launchpad-launch-at-login"
                      onChange={onLaunchAtLogin}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Always check if DevLens is your default browser"
                    detail="Refresh default-browser status whenever the DevLens window gains focus."
                  >
                    <Switch
                      checked={launchpad.checkDefaultBrowser}
                      testId="launchpad-check-default-browser"
                      onChange={(checked) => onLaunchpad({ checkDefaultBrowser: checked })}
                    />
                  </SettingRow>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Target"
                detail="Choose the surface opened by a new tab and by the homepage target."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] text-ink-400">New tab</p>
                    <Segmented
                      value={launchpad.newTabTarget}
                      testId="launchpad-new-tab-target"
                      onChange={(value) => onLaunchpad({ newTabTarget: value as LaunchTarget })}
                      options={[
                        { value: 'launchpad', label: 'Launchpad' },
                        { value: 'blank', label: 'Blank Canvas' },
                        { value: 'custom', label: 'Custom URL' }
                      ]}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] text-ink-400">Homepage</p>
                    <Segmented
                      value={launchpad.homeTarget}
                      testId="launchpad-home-target"
                      onChange={(value) => onLaunchpad({ homeTarget: value as LaunchTarget })}
                      options={[
                        { value: 'launchpad', label: 'Launchpad' },
                        { value: 'blank', label: 'Blank Canvas' },
                        { value: 'custom', label: 'Custom URL' }
                      ]}
                    />
                  </div>
                </div>
                <div
                  className={[
                    'mt-4 flex flex-col gap-2 transition-opacity sm:flex-row',
                    customUrlEnabled ? 'opacity-100' : 'opacity-45'
                  ].join(' ')}
                >
                  <label
                    aria-disabled={!customUrlEnabled}
                    title={
                      customUrlEnabled
                        ? 'Address used when either target is set to Custom URL'
                        : 'Choose Custom URL for New tab or Homepage to edit this address'
                    }
                    className={[
                      'flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3',
                      customUrlEnabled
                        ? 'border-[var(--devlens-hairline)] bg-black/20 focus-within:border-[var(--devlens-accent-line)]'
                        : 'cursor-not-allowed border-white/5 bg-white/[0.015]'
                    ].join(' ')}
                  >
                    <Globe2
                      size={15}
                      className={customUrlEnabled ? 'shrink-0 text-ink-500' : 'shrink-0 text-ink-600'}
                    />
                    <input
                      type="text"
                      value={homeDraft}
                      data-testid="launchpad-custom-url"
                      disabled={!customUrlEnabled}
                      aria-disabled={!customUrlEnabled}
                      spellCheck={false}
                      onChange={(event) => setHomeDraft(event.target.value)}
                      onBlur={commitHomepage}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                      }}
                      className="min-w-0 flex-1 bg-transparent text-[12px] text-ink-200 outline-none disabled:cursor-not-allowed disabled:text-ink-500"
                    />
                  </label>
                  <button
                    type="button"
                    data-testid="launchpad-save-custom-url"
                    disabled={!customUrlEnabled}
                    onClick={commitHomepage}
                    className="h-10 rounded-lg border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-4 text-[12px] text-[var(--devlens-accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-ink-500 disabled:hover:brightness-100"
                  >
                    Save URL
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-ink-500">
                  {customUrlEnabled
                    ? 'This address is used whenever New tab or Homepage is set to Custom URL.'
                    : 'Choose Custom URL for New tab or Homepage to enable this address.'}
                </p>
              </SettingsCard>

              <SettingsCard
                title="Widgets"
                detail="Turn each Launchpad card on or off without changing the rest of the grid."
              >
                <div className="grid gap-x-5 sm:grid-cols-2">
                  {WIDGET_ROWS.map((row) => (
                    <SettingRow key={row.key} label={row.label} detail={row.detail}>
                      <Switch
                        checked={launchpad.widgets[row.key]}
                        testId={`launchpad-widget-${row.key}`}
                        onChange={(checked) =>
                          onLaunchpad({
                            widgets: { ...launchpad.widgets, [row.key]: checked }
                          })
                        }
                      />
                    </SettingRow>
                  ))}
                </div>
                <label className="mt-3 flex h-8 items-center gap-2 rounded-md border border-[var(--devlens-hairline)] bg-black/20 px-2.5 focus-within:border-[var(--devlens-accent-line)]">
                  <Globe2 size={12} className="shrink-0 text-ink-500" />
                  <input
                    value={weatherDraft}
                    data-testid="launchpad-weather-place"
                    onChange={(event) => setWeatherDraft(event.target.value)}
                    onBlur={commitWeatherPlace}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    placeholder="Weather place"
                    aria-label="Weather place"
                    className="min-w-0 flex-1 bg-transparent text-[10px] text-ink-200 outline-none"
                  />
                </label>
              </SettingsCard>

              <SettingsCard
                title="Activity & Visuals"
                detail="Choose the shelves below the widget grid and give the Launchpad its own background."
              >
                <div className="divide-y divide-white/[0.05]">
                  {ACTIVITY_ROWS.map((row) => (
                    <SettingRow key={row.key} label={row.label} detail={row.detail}>
                      <Switch
                        checked={launchpad.activity[row.key]}
                        testId={`launchpad-activity-${row.key}`}
                        onChange={(checked) =>
                          onLaunchpad({
                            activity: { ...launchpad.activity, [row.key]: checked }
                          })
                        }
                      />
                    </SettingRow>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-ink-200">Launchpad wallpaper</p>
                      <p className="mt-0.5 text-[10px] text-ink-500">
                        Built-in artwork or an image from this computer.
                      </p>
                    </div>
                    <span data-testid="launchpad-wallpaper-active-label" className="font-mono text-[9px] text-ink-600">
                      {launchpad.wallpaperPreset === 'custom'
                        ? 'Custom image'
                        : WALLPAPER_PRESETS.find((preset) => preset.id === launchpad.wallpaperPreset)?.label ??
                          'Theme surface'}
                    </span>
                  </div>
                  <div data-testid="launchpad-wallpaper-gallery" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {WALLPAPER_PRESETS.map((preset) => {
                      const selected = launchpad.wallpaperPreset === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={selected}
                          data-selected={selected}
                          data-testid={`launchpad-wallpaper-preset-${preset.id}`}
                          onClick={() => onLaunchpad({ wallpaperPreset: preset.id, wallpaper: '' })}
                          className={[
                            'group relative aspect-video min-w-0 overflow-hidden rounded-md border text-left transition-all active:scale-[0.985]',
                            selected
                              ? 'border-[var(--devlens-accent-line)] ring-1 ring-[var(--devlens-accent-line)]'
                              : 'border-[var(--devlens-hairline)] hover:border-white/25'
                          ].join(' ')}
                          style={{ backgroundImage: `url("${preset.image}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                        >
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5">
                            <span className="block truncate text-[9px] text-white">{preset.label}</span>
                          </span>
                          {selected && <span className="pointer-events-none absolute inset-0 bg-[var(--devlens-accent)]/12" />}
                          {selected && (
                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--devlens-accent)] text-ink-950">
                              <Check size={9} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      aria-pressed={launchpad.wallpaperPreset === 'none'}
                      data-selected={launchpad.wallpaperPreset === 'none'}
                      data-testid="launchpad-wallpaper-none"
                      onClick={() => onLaunchpad({ wallpaperPreset: 'none', wallpaper: '' })}
                      className={[
                        'flex aspect-video min-w-0 flex-col items-center justify-center rounded-md border bg-[var(--devlens-accent-soft)] px-2 text-center transition-transform active:scale-[0.985]',
                        launchpad.wallpaperPreset === 'none'
                          ? 'border-[var(--devlens-accent-line)] ring-1 ring-[var(--devlens-accent-line)]'
                          : 'border-[var(--devlens-hairline)] hover:border-white/25'
                      ].join(' ')}
                    >
                      <span className="text-[9px] text-ink-200">Theme surface</span>
                      <span className="mt-0.5 text-[8px] text-ink-500">No image</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={launchpad.wallpaperPreset === 'custom'}
                      data-selected={launchpad.wallpaperPreset === 'custom'}
                      data-testid="launchpad-choose-wallpaper"
                      onClick={onChooseWallpaper}
                      className={[
                        'relative flex aspect-video min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border bg-black/20 px-2 text-center transition-transform active:scale-[0.985]',
                        launchpad.wallpaperPreset === 'custom'
                          ? 'border-[var(--devlens-accent-line)] ring-1 ring-[var(--devlens-accent-line)]'
                          : 'border-dashed border-[var(--devlens-hairline)] hover:border-white/25'
                      ].join(' ')}
                      style={
                        launchpad.wallpaper
                          ? { backgroundImage: `url("${launchpad.wallpaper}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
                          : undefined
                      }
                    >
                      {launchpad.wallpaper && <span className="absolute inset-0 bg-black/45" />}
                      <span className="relative text-[9px] text-white">Custom image</span>
                      <span className="relative mt-0.5 text-[8px] text-ink-300">Choose image…</span>
                    </button>
                  </div>
                </div>
                {wallpaperUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-[10px] text-ink-500">Dim</span>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={2}
                      value={launchpad.wallpaperDim}
                      data-testid="launchpad-wallpaper-dim"
                      onChange={(event) =>
                        onLaunchpad({ wallpaperDim: Number(event.target.value) })
                      }
                      className="min-w-0 flex-1 accent-[var(--devlens-accent)]"
                    />
                    <span className="w-9 text-right font-mono text-[10px] text-ink-300">
                      {launchpad.wallpaperDim}%
                    </span>
                  </div>
                )}
              </SettingsCard>
            </div>
          )}

          {category === 'search' && (
            <OmniboxSettingsContent
              settings={omnibox}
              onChange={onOmnibox}
              favicons={omniboxFavicons}
            />
          )}

          {category === 'privacy' && (
            <div className="flex flex-col gap-4">
              <SettingsCard
                title="DevLens Shield Status"
                detail="Live protection state from the local request engine."
              >
                <div
                  data-testid="privacy-shield-status"
                  className="flex flex-wrap items-center gap-4 rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-4 py-3"
                >
                  <LensyMascot shield size={62} showName={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink-100">DevLens Shield Active</p>
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      {PROTECTION_DESCRIPTORS[protection.level].label} - {privacy.shieldMode === 'strict'
                        ? 'aggressive host coverage'
                        : 'compatibility-first coverage'}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-4">
                    <div className="text-right">
                      <p data-testid="shield-blocked-count" className="font-mono text-[24px] leading-6 text-ink-100">
                        {protection.blockedRequests}
                      </p>
                      <p className="text-[9px] uppercase tracking-wide text-ink-500">trackers blocked</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-ink-500 sm:grid-cols-4">
                  <span>{protection.scrubbedHeaders} header(s) scrubbed</span>
                  <span>{protection.trimmedReferers} referer(s) trimmed</span>
                  <span>{privacy.siteExceptions.length} site exception(s)</span>
                  <span>{privacy.dnsMode === 'secure' ? 'DoH enforced' : 'DNS mode variable'}</span>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Enhanced Tracking Defense"
                detail="Choose the Shield posture and which classes of hostile code are cancelled."
              >
                <Segmented
                  value={privacy.shieldMode}
                  testId="privacy-shield-mode"
                  onChange={(value) => onShieldMode(value as ShieldMode)}
                  options={[
                    { value: 'standard', label: 'Standard Defense (Default)' },
                    { value: 'strict', label: 'Strict Dev Shield' }
                  ]}
                />
                <div className="mt-4 divide-y divide-white/[0.05]">
                  <SettingRow
                    label="Cross-site trackers"
                    detail="Cancel analytics, pixels and known third-party session recorders."
                  >
                    <Switch
                      checked={privacy.blockCrossSiteTrackers}
                      testId="privacy-block-cross-site"
                      onChange={(checked) =>
                        onShieldRules({
                          blockCrossSiteTrackers: checked,
                          blockFingerprinters: privacy.blockFingerprinters,
                          blockCryptominers: privacy.blockCryptominers,
                          sendDnt: privacy.sendDnt
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow
                    label="Fingerprinters"
                    detail="Strip client hints and send privacy signals to reduce device uniqueness."
                  >
                    <Switch
                      checked={privacy.blockFingerprinters}
                      testId="privacy-block-fingerprinters"
                      onChange={(checked) =>
                        onShieldRules({
                          blockCrossSiteTrackers: privacy.blockCrossSiteTrackers,
                          blockFingerprinters: checked,
                          blockCryptominers: privacy.blockCryptominers,
                          sendDnt: privacy.sendDnt
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow
                    label="Cryptominers"
                    detail="Block known mining hosts before a worker is downloaded."
                  >
                    <Switch
                      checked={privacy.blockCryptominers}
                      testId="privacy-block-cryptominers"
                      onChange={(checked) =>
                        onShieldRules({
                          blockCrossSiteTrackers: privacy.blockCrossSiteTrackers,
                          blockFingerprinters: privacy.blockFingerprinters,
                          blockCryptominers: checked,
                          sendDnt: privacy.sendDnt
                        })
                      }
                    />
                  </SettingRow>
                </div>
              </SettingsCard>

              <SettingsCard
                title="DevLens Shield Network"
                detail="Proxy and VPN tunnel status. A relay can be configured without weakening local-only filtering."
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'h-2 w-2 rounded-full',
                        privacy.networkTunnelEnabled ? 'bg-emerald-400' : 'bg-ink-500'
                      ].join(' ')}
                    />
                    <div>
                      <p className="text-[11px] text-ink-200">
                        {privacy.networkTunnelEnabled ? 'Tunnel requested - waiting for relay' : 'Network Tunnel standby'}
                      </p>
                      <p className="text-[10px] text-ink-500">No VPN relay is configured.</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[10px] text-ink-400">
                    Limit
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={privacy.dataLimitGb}
                      data-testid="privacy-data-limit"
                      onChange={(event) =>
                        onPrivacy({ dataLimitGb: Math.max(1, Number(event.target.value) || 1) })
                      }
                      className="h-7 w-20 rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 font-mono text-[10px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
                    />
                    GB
                  </label>
                </div>
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-[var(--devlens-accent)]"
                      style={{
                        width: `${Math.min(
                          100,
                          (privacy.dataUsedGb / Math.max(1, privacy.dataLimitGb)) * 100
                        )}%`
                      }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-ink-500">
                    {privacy.dataUsedGb.toFixed(1)} GB used / {privacy.dataLimitGb} GB allocation
                  </p>
                </div>
              </SettingsCard>

              <BrowsingDataSettingsContent
                privacy={privacy}
                diskUsage={diskUsage}
                onPrivacy={onPrivacy}
                onHistoryPolicy={onHistoryPolicy}
                onClearBrowsingData={onClearBrowsingDataSelected}
                onRunCleanup={onRunRetentionCleanup}
                onRefreshUsage={onRefreshDiskUsage}
              />

              <SettingsCard
                title="Shield Site Exceptions"
                detail="Domains exempt from DevLens Shield filtering. Browsing-data retention has its own exceptions."
              >
                <div className="flex items-center gap-1.5">
                  <input
                    value={exceptionDraft}
                    data-testid="privacy-exception-input"
                    onChange={(event) => setExceptionDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addException()
                      }
                    }}
                    placeholder="example.com"
                    className="h-8 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 font-mono text-[10px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
                  />
                  <button
                    type="button"
                    onClick={addException}
                    disabled={!exceptionDraft.trim()}
                    className="h-8 rounded border border-[var(--devlens-hairline)] px-2.5 text-[10px] text-ink-300 hover:border-[var(--devlens-accent-line)] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
                <ul className="mt-2 flex flex-col divide-y divide-white/[0.05]">
                  {protection.allowedSites.map((site) => (
                    <li key={site} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-300">
                        {site}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove exception for ${site}`}
                        onClick={() => onSiteException(site, false)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 size={10} />
                      </button>
                    </li>
                  ))}
                  {protection.allowedSites.length === 0 && (
                    <li className="py-2 text-[10px] text-ink-600">No site exceptions.</li>
                  )}
                </ul>
              </SettingsCard>

              <SettingsCard
                title="Advanced Protocols & DNS"
                detail="Network privacy controls persisted with this profile."
              >
                <div className="divide-y divide-white/[0.05]">
                  <SettingRow
                    label="Do Not Track / Global Privacy Control"
                    detail="Send both opt-out signals with outgoing requests."
                  >
                    <Switch
                      checked={privacy.sendDnt}
                      testId="privacy-send-dnt"
                      onChange={(checked) =>
                        onShieldRules({
                          blockCrossSiteTrackers: privacy.blockCrossSiteTrackers,
                          blockFingerprinters: privacy.blockFingerprinters,
                          blockCryptominers: privacy.blockCryptominers,
                          sendDnt: checked
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow
                    label="Secure DNS over HTTPS (DoH)"
                    detail="Secure uses Cloudflare DoH; System follows the operating system."
                  >
                    <span />
                  </SettingRow>
                </div>
                <div className="mt-2">
                  <Segmented
                    value={privacy.dnsMode}
                    testId="privacy-doh-mode"
                    onChange={(value) =>
                      onNetworkSecurity({
                        dnsMode: value as DnsMode,
                        httpsOnly: privacy.httpsOnly
                      })
                    }
                    options={[
                      { value: 'secure', label: 'Secure' },
                      { value: 'system', label: 'System' },
                      { value: 'off', label: 'Off' }
                    ]}
                  />
                </div>
                <div className="mt-3">
                  <SettingRow
                    label="HTTPS-Only Connection Security"
                    detail="Upgrade ordinary HTTP navigation to HTTPS; localhost stays untouched."
                  >
                    <Switch
                      checked={privacy.httpsOnly}
                      testId="privacy-https-only"
                      onChange={(checked) =>
                        onNetworkSecurity({ dnsMode: privacy.dnsMode, httpsOnly: checked })
                      }
                    />
                  </SettingRow>
                </div>
              </SettingsCard>
            </div>
          )}

          {category === 'appearance' && (
            <div className="flex flex-col gap-4">
              <SettingsCard
                title="Web Content Theme Mode"
                detail="Ask sites to render with a light, dark or system-following color scheme."
              >
                <Segmented
                  value={appearance.contentTheme}
                  testId="appearance-content-theme"
                  onChange={(value) =>
                    onAppearance({ contentTheme: value as ContentThemeMode })
                  }
                  options={[
                    { value: 'system', label: 'Follow System' },
                    { value: 'light', label: 'Light Mode' },
                    { value: 'dark', label: 'Dark Mode' }
                  ]}
                />
              </SettingsCard>

              <SettingsCard
                title="DevLens Workspace Themes"
                detail="Recolor toolbars, tabs and sidebars without changing the website content theme."
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    value={appearance.workspaceTheme}
                    data-testid="appearance-workspace-theme"
                    onChange={(event) =>
                      onAppearance({
                        workspaceTheme: event.target.value as WorkspaceThemeId
                      })
                    }
                    className="h-9 min-w-0 flex-1 rounded-md border border-[var(--devlens-hairline)] bg-ink-900 px-2.5 text-[11px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
                  >
                    {WORKSPACE_THEMES.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="appearance-manage-themes"
                    onClick={onOpenThemes}
                    className="flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--devlens-hairline)] px-3 text-[10px] text-ink-200 hover:border-[var(--devlens-accent-line)]"
                  >
                    Manage DevLens Themes
                    <ChevronRight size={11} />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  {WORKSPACE_THEMES.map((theme) => {
                    const selected = appearance.workspaceTheme === theme.id
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        aria-label={`Use ${theme.label}`}
                        aria-pressed={selected}
                        onClick={() => onAppearance({ workspaceTheme: theme.id })}
                        className={[
                          'flex min-w-0 flex-1 flex-col gap-1.5 rounded-md border p-1.5',
                          selected
                            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                            : 'border-[var(--devlens-hairline)]'
                        ].join(' ')}
                      >
                        <span className="flex h-8 overflow-hidden rounded-sm">
                          {theme.swatches.map((color) => (
                            <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                        <span className="truncate text-[9px] text-ink-400">{theme.label}</span>
                      </button>
                    )
                  })}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Browser Icon"
                detail="Choose a custom icon for your taskbar, desktop and Start menu."
              >
                <div data-testid="appearance-browser-icon" className="flex flex-wrap items-center gap-3.5">
                  <AppIconPreview style={appearance.appIcon} size={54} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12px] font-medium text-ink-100">{appIconDesign(appearance.appIcon).label}</p>
                      <span className="rounded-full bg-[var(--devlens-accent-soft)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--devlens-accent)]">
                        New
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-ink-500">
                      A distinctive browser mark for the taskbar, desktop and Start menu.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="appearance-change-icon"
                    onClick={() => setIconPickerOpen(true)}
                    className="flex items-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] px-3 py-2 text-[10px] text-ink-200 hover:border-[var(--devlens-accent-line)] hover:bg-white/[0.03]"
                  >
                    Change browser icon
                    <ChevronRight size={11} />
                  </button>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Fonts"
                detail="Choose typefaces for DevLens chrome and developer surfaces."
              >
                <div
                  data-testid="appearance-fonts"
                  style={{ fontFamily: 'var(--font-ui-fixed)' }}
                >
                  <div
                    data-testid="appearance-font-preview"
                    className="mb-4 overflow-hidden rounded-md border border-[var(--devlens-hairline)] bg-black/20"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--devlens-hairline)] px-3.5 py-2">
                      <span className="text-[8px] uppercase tracking-[0.16em] text-ink-500">
                        Live specimen
                      </span>
                      <span className="flex items-center gap-1 text-[9px] text-[var(--devlens-accent)]">
                        <Check size={10} />
                        Applied to DevLens
                      </span>
                    </div>
                    <div className="px-4 py-4">
                      <p
                        data-testid="appearance-font-preview-interface"
                        className="text-[22px] leading-tight text-ink-100"
                        style={{ fontFamily: selectedUiFont.family }}
                      >
                        Build sharp. Inspect everything.
                      </p>
                      <p
                        className="mt-2 text-[10px] leading-5 text-ink-400"
                        style={{ fontFamily: selectedUiFont.family }}
                      >
                        The quick brown fox jumps over the lazy dog. 0123456789
                      </p>
                      <pre
                        data-testid="appearance-font-preview-code"
                        className="mt-3 overflow-x-auto rounded border border-[var(--devlens-hairline)] bg-ink-950/70 px-3 py-2 text-[11px] leading-5 text-ink-200"
                        style={{ fontFamily: selectedCodeFont.family }}
                      >
                        {'const lens = { mode: "dev", ready: true }\n> inspect(viewport)'}
                      </pre>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-ink-200">Interface font</p>
                      <p className="mt-0.5 text-[10px] text-ink-500">Menus, tabs, settings and dialogs</p>
                    </div>
                    <span className="shrink-0 text-[9px] text-ink-600">
                      {selectedUiFont.label}
                    </span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Interface font"
                    data-testid="appearance-ui-font"
                    className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3"
                  >
                    {INTERFACE_FONTS.map((font) => {
                      const selected = appearance.uiFont === font.id
                      return (
                        <button
                          key={font.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          data-testid={`appearance-ui-font-${font.id}`}
                          onClick={() => onAppearance({ uiFont: font.id as UiFontId })}
                          className={[
                            'relative flex min-w-0 flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent)]',
                            selected
                              ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                              : 'border-[var(--devlens-hairline)] hover:border-white/20 hover:bg-white/[0.03]'
                          ].join(' ')}
                        >
                          <span className="text-[19px] leading-none text-ink-100" style={{ fontFamily: font.family }}>
                            Aa
                          </span>
                          <span
                            data-testid={`appearance-ui-font-label-${font.id}`}
                            className="mt-2 w-full truncate text-[10px] text-ink-200"
                          >
                            {font.label}
                          </span>
                          <span className="mt-0.5 w-full truncate text-[9px] text-ink-500">{font.detail}</span>
                          {selected && (
                            <Check size={11} className="absolute right-2.5 top-2.5 text-[var(--devlens-accent)]" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div className="my-4 h-px bg-[var(--devlens-hairline)]" />

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-ink-200">Code font</p>
                      <p className="mt-0.5 text-[10px] text-ink-500">Developer tools, logs and monospace details</p>
                    </div>
                    <span className="shrink-0 text-[9px] text-ink-600">
                      {selectedCodeFont.label}
                    </span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Code font"
                    data-testid="appearance-code-font"
                    className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3"
                  >
                    {CODE_FONTS.map((font) => {
                      const selected = appearance.codeFont === font.id
                      return (
                        <button
                          key={font.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          data-testid={`appearance-code-font-${font.id}`}
                          onClick={() => onAppearance({ codeFont: font.id as CodeFontId })}
                          className={[
                            'relative flex min-w-0 flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent)]',
                            selected
                              ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                              : 'border-[var(--devlens-hairline)] hover:border-white/20 hover:bg-white/[0.03]'
                          ].join(' ')}
                        >
                          <span className="text-[12px] leading-none text-ink-100" style={{ fontFamily: font.family }}>
                            const lens = 42
                          </span>
                          <span
                            data-testid={`appearance-code-font-label-${font.id}`}
                            className="mt-2 w-full truncate text-[10px] text-ink-200"
                          >
                            {font.label}
                          </span>
                          <span className="mt-0.5 w-full truncate text-[9px] text-ink-500">{font.detail}</span>
                          {selected && (
                            <Check size={11} className="absolute right-2.5 top-2.5 text-[var(--devlens-accent)]" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard
                title="UI Density & Spacing"
                detail="Automatic follows the available screen size; touch enlarges the primary controls."
              >
                <Segmented
                  value={appearance.density}
                  testId="appearance-density"
                  onChange={(value) => onAppearance({ density: value as UiDensity })}
                  options={[
                    { value: 'automatic', label: 'Automatic' },
                    { value: 'standard', label: 'Standard' },
                    { value: 'compact', label: 'Compact' },
                    { value: 'touch', label: 'Touch' }
                  ]}
                />
              </SettingsCard>

              <SettingsCard
                title="Related Shortcuts & Layout"
                detail="Jump directly to the controls that pair with visual tuning."
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  <ShortcutTile
                    label="Zoom & Font Accessibility"
                    detail={`Current page zoom: ${browser.defaultZoom}%`}
                    onClick={() =>
                      document.getElementById('devlens-zoom-settings')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                      })
                    }
                  />
                  <ShortcutTile
                    label="Customise Launchpad"
                    detail="devlens:settings/home"
                    onClick={() => onCategoryChange('home')}
                  />
                  <ShortcutTile
                    label="Dock & Sidebar Layout"
                    detail="Toolbar position and visible tools"
                    onClick={() =>
                      document.getElementById('devlens-layout-settings')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                      })
                    }
                  />
                </div>
              </SettingsCard>

              <div id="devlens-zoom-settings">
                <SettingsCard
                  title="Page zoom"
                  detail="Default zoom is applied to newly attached pages and updates the active page."
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="range"
                      min={50}
                      max={200}
                      step={10}
                      value={browser.defaultZoom}
                      data-testid="settings-default-zoom"
                      onChange={(event) => onBrowser({ defaultZoom: Number(event.target.value) })}
                      className="min-w-[220px] flex-1 accent-[var(--devlens-accent)]"
                    />
                    <span className="w-12 text-right font-mono text-[12px] text-ink-100">
                      {browser.defaultZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => onBrowser({ defaultZoom: 100 })}
                      className="h-8 rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[10px] text-ink-300 hover:bg-white/[0.04]"
                    >
                      Reset
                    </button>
                  </div>
                </SettingsCard>
              </div>

              <SettingsCard
                title="Bookmarks bar"
                detail="Choose which bookmark surfaces appear in the window."
              >
                <div className="divide-y divide-white/[0.05]">
                  <SettingRow label="Show the bookmarks bar" detail="A one-line bar under the toolbar.">
                    <Switch
                      checked={bookmarkOptions.toolbarVisible}
                      testId="settings-bookmarks-bar"
                      onChange={(checked) => onBookmarkOptions({ toolbarVisible: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Show Other Bookmarks" detail="Keep the overflow chip beside the bar's items.">
                    <Switch
                      checked={bookmarkOptions.showOtherBookmarks}
                      testId="settings-other-bookmarks"
                      onChange={(checked) => onBookmarkOptions({ showOtherBookmarks: checked })}
                    />
                  </SettingRow>
                </div>
              </SettingsCard>

              <div id="devlens-layout-settings">
                <SettingsCard
                  title="Toolbar and sidebar"
                  detail="The dock handle moves; the toolbar tools can be hidden individually."
                >
                  <p className="mb-2 text-[10px] text-ink-400">Sidebar handle position</p>
                  <Segmented
                    value={toolbarLayout.sidebarToggle}
                    testId="settings-sidebar-position"
                    onChange={(value) =>
                      onLayout({ sidebarToggle: value as SidebarTogglePosition })
                    }
                    options={[
                      { value: 'start', label: 'Far left', icon: <ArrowLeftToLine size={13} /> },
                      { value: 'end', label: 'With the tools', icon: <ArrowRightToLine size={13} /> }
                    ]}
                  />
                  <div className="mt-4 divide-y divide-white/[0.05]">
                    {TOOL_ROWS.map((row) => (
                      <SettingRow key={row.key} label={row.label} detail={row.detail}>
                        <Switch
                          checked={toolbarLayout.tools[row.key]}
                          testId={`settings-page-tool-${row.key}`}
                          onChange={(checked) => onLayout({ tools: { [row.key]: checked } })}
                        />
                      </SettingRow>
                    ))}
                  </div>
                </SettingsCard>
              </div>
            </div>
          )}

          {category === 'tabs' && (
            <div className="flex flex-col gap-4">
              <SettingsCard
                title="Tab Strip Layout Mode"
                detail="Switch between the classic top strip and a wide-screen vertical rail."
              >
                <Segmented
                  value={tabsPreferences.layout}
                  testId="tabs-layout"
                  onChange={(value) =>
                    onTabs({ layout: value === 'vertical' ? 'vertical' : 'horizontal' })
                  }
                  options={[
                    { value: 'horizontal', label: 'Horizontal Tabs' },
                    { value: 'vertical', label: 'Vertical Tabs' }
                  ]}
                />
              </SettingsCard>

              <SettingsCard
                title="Tab Behavior & Interaction"
                detail="Control how tabs open, switch and participate in the developer workspace."
              >
                <div className="divide-y divide-white/[0.05]">
                  <SettingRow label="Switch to new tabs immediately" detail="When disabled, new links open in the background.">
                    <Switch
                      checked={tabsPreferences.switchToNewTabs}
                      testId="tabs-switch-new"
                      onChange={(checked) => onTabs({ switchToNewTabs: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="External links beside current tab" detail="Place new links from other apps and web pages next to the current tab.">
                    <Switch
                      checked={tabsPreferences.externalLinksBesideCurrent}
                      testId="tabs-links-beside"
                      onChange={(checked) => onTabs({ externalLinksBesideCurrent: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Ctrl+Tab uses recent order" detail="Switch to the most recently used tab instead of the adjacent tab.">
                    <Switch
                      checked={tabsPreferences.mruSwitching}
                      testId="tabs-mru"
                      onChange={(checked) => onTabs({ mruSwitching: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Tab hover preview" detail="Show a live metadata and page thumbnail preview when hovering a tab.">
                    <Switch
                      checked={tabsPreferences.hoverPreview}
                      testId="tabs-hover-preview"
                      onChange={(checked) => onTabs({ hoverPreview: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Drag tabs into groups" detail="Enable developer tab groups when dragging tabs together.">
                    <Switch
                      checked={tabsPreferences.tabGroups}
                      testId="tabs-groups"
                      onChange={(checked) => onTabs({ tabGroups: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Windows taskbar tab previews" detail="Expose tab previews to the operating system taskbar.">
                    <Switch
                      checked={tabsPreferences.taskbarPreviews}
                      testId="tabs-taskbar-preview"
                      onChange={(checked) => onTabs({ taskbarPreviews: checked })}
                    />
                  </SettingRow>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Environment Containers"
                detail="Define isolated Cookie and Session containers for development environments."
              >
                <SettingRow label="Enable Environment Containers" detail="Make container definitions available when opening tabs.">
                  <Switch
                    checked={tabsPreferences.containersEnabled}
                    testId="tabs-containers-enabled"
                    onChange={(checked) => onTabs({ containersEnabled: checked })}
                  />
                </SettingRow>
                <div className="mt-3 flex flex-col gap-2">
                  {tabsPreferences.containers.map((container) => (
                    <div key={container.id} className="flex items-center gap-2 rounded-md border border-[var(--devlens-hairline)] px-2.5 py-2">
                      <input
                        type="color"
                        value={container.color}
                        aria-label={`Color for ${container.label}`}
                        onChange={(event) =>
                          onTabs({
                            containers: tabsPreferences.containers.map((entry) =>
                              entry.id === container.id
                                ? { ...entry, color: event.target.value }
                                : entry
                            )
                          })
                        }
                        className="h-6 w-6 rounded border-0 bg-transparent p-0"
                      />
                      <input
                        value={container.label}
                        aria-label="Container name"
                        onChange={(event) =>
                          onTabs({
                            containers: tabsPreferences.containers.map((entry) =>
                              entry.id === container.id
                                ? { ...entry, label: event.target.value }
                                : entry
                            )
                          })
                        }
                        className="h-7 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 text-[10px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
                      />
                      <Switch
                        checked={container.enabled}
                        testId={`tabs-container-${container.id}`}
                        onChange={(checked) =>
                          onTabs({
                            containers: tabsPreferences.containers.map((entry) =>
                              entry.id === container.id
                                ? { ...entry, enabled: checked }
                                : entry
                            )
                          })
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${container.label}`}
                        onClick={() =>
                          onTabs({
                            containers: tabsPreferences.containers.filter(
                              (entry) => entry.id !== container.id
                            )
                          })
                        }
                        className="flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:text-rose-300"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDevContainer}
                    className="self-start rounded-md border border-[var(--devlens-hairline)] px-2.5 py-1.5 text-[10px] text-ink-300 hover:border-[var(--devlens-accent-line)]"
                  >
                    Add container
                  </button>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Navigation & Smart Previews"
                detail="Developer navigation aids and link inspection."
              >
                <div className="divide-y divide-white/[0.05]">
                  <SettingRow label="Keyboard Page Cursor" detail="Navigate links and focusable controls with an on-page cursor.">
                    <Switch
                      checked={tabsPreferences.pageCursor}
                      testId="tabs-page-cursor"
                      onChange={(checked) => onTabs({ pageCursor: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Type to search text" detail="Typing without a focused field starts an in-page text search.">
                    <Switch
                      checked={tabsPreferences.typeToSearch}
                      testId="tabs-type-search"
                      onChange={(checked) => onTabs({ typeToSearch: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Dev Lens Link Preview" detail="Long-press or right-click a link for metadata and AI summary previews.">
                    <Switch
                      checked={tabsPreferences.linkPreview}
                      testId="tabs-link-preview"
                      onChange={(checked) => onTabs({ linkPreview: checked })}
                    />
                  </SettingRow>
                </div>
                <p className="mt-4 mb-2 text-[10px] text-ink-400">Customise Hotkeys</p>
                <div className="flex flex-col gap-1.5">
                  {tabsPreferences.hotkeys.map((hotkey) => (
                    <div key={hotkey.id} className="flex items-center gap-2">
                      <input
                        value={hotkey.label}
                        aria-label="Hotkey action"
                        onChange={(event) =>
                          onTabs({
                            hotkeys: tabsPreferences.hotkeys.map((entry) =>
                              entry.id === hotkey.id
                                ? { ...entry, label: event.target.value }
                                : entry
                            )
                          })
                        }
                        className="h-7 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 text-[10px] text-ink-200 outline-none"
                      />
                      <input
                        value={hotkey.shortcut}
                        aria-label={`Shortcut for ${hotkey.label}`}
                        placeholder="Ctrl+…"
                        onChange={(event) =>
                          onTabs({
                            hotkeys: tabsPreferences.hotkeys.map((entry) =>
                              entry.id === hotkey.id
                                ? { ...entry, shortcut: event.target.value }
                                : entry
                            )
                          })
                        }
                        className="h-7 w-28 rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 font-mono text-[10px] text-ink-200 outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${hotkey.label}`}
                        onClick={() =>
                          onTabs({
                            hotkeys: tabsPreferences.hotkeys.filter(
                              (entry) => entry.id !== hotkey.id
                            )
                          })
                        }
                        className="flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:text-rose-300"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addHotkey}
                    className="self-start rounded-md border border-[var(--devlens-hairline)] px-2.5 py-1.5 text-[10px] text-ink-300 hover:border-[var(--devlens-accent-line)]"
                  >
                    Add hotkey
                  </button>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Media & Hardware Performance"
                detail="Persistent playback and browser rendering controls."
              >
                <div className="divide-y divide-white/[0.05]">
                  <SettingRow label="Keep PiP playing on tab switch" detail="Leave floating videos running when you move between tabs.">
                    <Switch
                      checked={tabsPreferences.pipOnTabSwitch}
                      testId="tabs-pip"
                      onChange={(checked) => onTabs({ pipOnTabSwitch: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="DRM content support" detail="Allow protected media playback where the platform supports it.">
                    <Switch
                      checked={tabsPreferences.drmEnabled}
                      testId="tabs-drm"
                      onChange={(checked) => onTabs({ drmEnabled: checked })}
                    />
                  </SettingRow>
                </div>
                <p className="mt-4 mb-2 text-[10px] text-ink-400">Hardware acceleration</p>
                <Segmented
                  value={tabsPreferences.hardwareAcceleration}
                  testId="tabs-hardware-acceleration"
                  onChange={(value) =>
                    onTabs({
                      hardwareAcceleration: value as HardwareAccelerationMode
                    })
                  }
                  options={[
                    { value: 'automatic', label: 'Automatic' },
                    { value: 'enabled', label: 'Performance' },
                    { value: 'disabled', label: 'Compatibility' }
                  ]}
                />
              </SettingsCard>

              <SettingsCard
                title="Bookmarks behavior"
                detail="Decide whether saved pages replace the current page or open beside it."
              >
                <SettingRow
                  label="Open bookmarks in a new tab"
                  detail="Applies to the bookmarks page and the bookmarks bar. Ctrl/Cmd-click always opens a new tab."
                >
                  <Switch
                    checked={browser.openBookmarksInNewTab}
                    testId="settings-bookmarks-new-tab"
                    onChange={(checked) => onBrowser({ openBookmarksInNewTab: checked })}
                  />
                </SettingRow>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--devlens-hairline)] px-3 py-2">
                  <span className="text-[10px] text-ink-400">
                    New tabs use {TARGET_LABELS[launchpad.newTabTarget]}.
                  </span>
                  <button
                    type="button"
                    onClick={() => onCategoryChange('home')}
                    className="flex h-7 items-center gap-1 rounded border border-[var(--devlens-hairline)] px-2 text-[10px] text-ink-300 hover:border-[var(--devlens-accent-line)]"
                  >
                    Launchpad settings
                    <ChevronRight size={10} />
                  </button>
                </div>
              </SettingsCard>
            </div>
          )}

          {category === 'developer' && (
            <div className="flex flex-col gap-4">
              <SettingsCard
                title="Open source in"
                detail="Detected from the editors registered on this computer."
              >
                <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--devlens-hairline)] px-3 py-2.5">
                  <div>
                    <p className="text-[11px] text-ink-200">Enable editor hand-off</p>
                    <p className="mt-0.5 text-[10px] text-ink-500">
                      Show Open in editor on the toolbar and allow click-to-source.
                    </p>
                  </div>
                  <Switch
                    checked={developer.ideEnabled}
                    testId="developer-ide-enabled"
                    onChange={(checked) => onDeveloperChange({ ideEnabled: checked })}
                  />
                </div>
                <div
                  aria-disabled={!developer.ideEnabled}
                  className={[
                    'mt-3 flex flex-col gap-2 transition-opacity sm:flex-row sm:items-center',
                    developer.ideEnabled ? 'opacity-100' : 'opacity-40'
                  ].join(' ')}
                >
                  <IdeSelect
                    options={ideOptions}
                    value={developer.ideId}
                    disabled={!developer.ideEnabled}
                    onChange={(ideId) => onDeveloperChange({ ideId })}
                  />
                  <span className="shrink-0 rounded-md border border-[var(--devlens-hairline)] px-2.5 py-1.5 font-mono text-[9px] text-ink-500">
                    {ideOptions.filter((option) => option.installed).length} editor
                    {ideOptions.filter((option) => option.installed).length === 1 ? '' : 's'} found
                  </span>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-ink-500">
                  {!developer.ideEnabled
                    ? 'Editor hand-off is off. The toolbar action is hidden and this selection is disabled.'
                    : ideOptions.find((option) => option.id === developer.ideId)?.detail ??
                      'This editor was selected previously but is not currently registered.'}
                </p>
              </SettingsCard>

              <SettingsCard
                title="AI assistant provider"
                detail="Which site the assistant panel opens on, and which brand the dock shows."
              >
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {AI_SITES.map((site) => {
                    const selected = site.id === aiProvider
                    const tile = AI_PROVIDER_TILE[site.id]
                    return (
                      <button
                        key={site.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-testid={`settings-provider-${site.id}`}
                        onClick={() => onProviderChange(site.id)}
                        className={[
                          'flex min-h-[58px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          selected
                            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                            : 'border-[var(--devlens-hairline)] hover:bg-white/[0.03]'
                        ].join(' ')}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-ink-200"
                          style={{ backgroundColor: tile.background, borderColor: tile.border }}
                        >
                          <AiMark
                            site={site.id}
                            size={site.id === 'deepseek' || site.id === 'claude' ? 21 : 18}
                            className="shrink-0"
                          />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-200">{site.label}</span>
                        {selected && <Check size={14} className="shrink-0 text-[var(--devlens-accent)]" />}
                      </button>
                    )
                  })}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Workspace tooling"
                detail="Developer controls are available from the toolbar's dock and the WImH defense panel."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoTile
                    icon={<Compass size={14} />}
                    label="Mode"
                    detail="Dev and Normal keep separate capability sets."
                  />
                  <InfoTile
                    icon={<LayoutPanelTop size={14} />}
                    label="Toolbar"
                    detail={`${Object.values(toolbarLayout.tools).filter(Boolean).length} developer tools visible`}
                  />
                </div>
              </SettingsCard>
            </div>
          )}

          {category === 'languages' && (
            <div className="flex flex-col gap-4">
              <SettingsCard
                title="DevLens Interface Language"
                detail="Choose the preferred language and fallback for DevLens chrome, menus and notifications."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[10px] text-ink-400">
                    Primary Display Language
                    <select
                      value={languages.primaryLanguage}
                      data-testid="languages-primary"
                      onChange={(event) =>
                        onLanguages({ primaryLanguage: event.target.value })
                      }
                      className="h-9 rounded-md border border-[var(--devlens-hairline)] bg-ink-900 px-2.5 text-[11px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
                    >
                      {LANGUAGE_OPTIONS.map((language) => (
                        <option key={language.id} value={language.id}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] text-ink-400">
                    Fallback Language
                    <select
                      value={languages.fallbackLanguage}
                      data-testid="languages-fallback"
                      onChange={(event) =>
                        onLanguages({ fallbackLanguage: event.target.value })
                      }
                      className="h-9 rounded-md border border-[var(--devlens-hairline)] bg-ink-900 px-2.5 text-[11px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
                    >
                      {LANGUAGE_OPTIONS.map((language) => (
                        <option key={language.id} value={language.id}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 divide-y divide-white/[0.05]">
                  <SettingRow
                    label="System Locale Formatting"
                    detail="Follow the OS for dates, times, numbers and measurement units."
                  >
                    <Switch
                      checked={languages.followSystemLocale}
                      testId="languages-follow-system"
                      onChange={(checked) => onLanguages({ followSystemLocale: checked })}
                    />
                  </SettingRow>
                </div>
                <label className="mt-3 flex items-center gap-2 text-[10px] text-ink-400">
                  Locale format
                  <input
                    value={languages.systemLocale}
                    data-testid="languages-system-locale"
                    onChange={(event) => onLanguages({ systemLocale: event.target.value })}
                    className="h-8 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 font-mono text-[10px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
                  />
                </label>
              </SettingsCard>

              <SettingsCard
                title="Web Content Preferred Languages"
                detail="Send these preferences in priority order when sites offer multiple languages."
              >
                <ol className="flex flex-col divide-y divide-white/[0.05]">
                  {languages.webLanguages.map((code, index) => (
                    <li key={code} className="flex items-center gap-2 py-2">
                      <span className="w-5 text-center font-mono text-[9px] text-ink-600">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-[11px] text-ink-200">
                        {LANGUAGE_OPTIONS.find((language) => language.id === code)?.label ?? code}
                      </span>
                      <span className="font-mono text-[9px] text-ink-500">{code}</span>
                      <button
                        type="button"
                        aria-label={`Move ${code} up`}
                        onClick={() => moveWebLanguage(index, -1)}
                        disabled={index === 0}
                        className="h-6 w-6 rounded text-ink-500 hover:bg-white/5 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${code} down`}
                        onClick={() => moveWebLanguage(index, 1)}
                        disabled={index === languages.webLanguages.length - 1}
                        className="h-6 w-6 rounded text-ink-500 hover:bg-white/5 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${code}`}
                        onClick={() =>
                          onLanguages({
                            webLanguages: languages.webLanguages.filter((entry) => entry !== code)
                          })
                        }
                        className="flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:text-rose-300"
                      >
                        <Trash2 size={10} />
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="mt-2 flex items-center gap-1.5">
                  <select
                    value={webLanguageDraft}
                    aria-label="Language to add"
                    onChange={(event) => setWebLanguageDraft(event.target.value)}
                    className="h-8 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-ink-900 px-2 text-[10px] text-ink-200"
                  >
                    {LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.id} value={language.id}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addWebLanguage}
                    className="h-8 rounded border border-[var(--devlens-hairline)] px-2.5 text-[10px] text-ink-300 hover:border-[var(--devlens-accent-line)]"
                  >
                    Add language
                  </button>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Privacy-First Local Translations"
                detail="Translation models run on this device; no selected text leaves the machine."
              >
                <div className="divide-y divide-white/[0.05]">
                  <SettingRow label="Local Neural Machine Translation" detail="Translate full pages or selected text on-device.">
                    <Switch
                      checked={languages.localTranslation}
                      testId="languages-local-translation"
                      onChange={(checked) => onLanguages({ localTranslation: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Automatic Page Translation Prompt" detail="Ask before translating a page whose language differs.">
                    <Switch
                      checked={languages.autoTranslatePrompt}
                      testId="languages-auto-prompt"
                      onChange={(checked) => onLanguages({ autoTranslatePrompt: checked })}
                    />
                  </SettingRow>
                </div>
                <p className="mt-4 mb-2 text-[10px] text-ink-400">Offline Dictionaries & Translation Models</p>
                <div className="flex flex-col gap-1.5">
                  {languages.offlineModels.map((model) => (
                    <div key={model.id} className="flex items-center gap-2 rounded border border-[var(--devlens-hairline)] px-2.5 py-2">
                      <span className="min-w-0 flex-1 text-[10px] text-ink-200">{model.label}</span>
                      <span className="font-mono text-[9px] text-ink-500">{model.size}</span>
                      <Switch
                        checked={model.installed}
                        testId={`languages-model-${model.id}`}
                        onChange={(installed) =>
                          onLanguages({
                            offlineModels: languages.offlineModels.map((entry) =>
                              entry.id === model.id ? { ...entry, installed } : entry
                            )
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Developer Spell Checker"
                detail="Real-time checking for prose and code comments; code identifiers stay untouched."
              >
                <SettingRow
                  label="Real-time Code & Text Spell Checking"
                  detail="Uses Chromium dictionaries and the active profile session."
                >
                  <Switch
                    checked={languages.spellCheck}
                    testId="languages-spell-check"
                    onChange={(checked) => onLanguages({ spellCheck: checked })}
                  />
                </SettingRow>
                <p className="mt-3 mb-1.5 text-[10px] text-ink-400">Spell-check languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGE_OPTIONS.slice(0, 6).map((language) => {
                    const selected = languages.spellCheckLanguages.includes(language.id)
                    return (
                      <button
                        key={language.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          onLanguages({
                            spellCheckLanguages: selected
                              ? languages.spellCheckLanguages.filter((code) => code !== language.id)
                              : [...languages.spellCheckLanguages, language.id]
                          })
                        }
                        className={[
                          'rounded-full border px-2 py-1 text-[9px]',
                          selected
                            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                            : 'border-[var(--devlens-hairline)] text-ink-400'
                        ].join(' ')}
                      >
                        {language.label}
                      </button>
                    )
                  })}
                </div>
              </SettingsCard>
            </div>
          )}

          {category === 'identity' && (
            <div className="flex flex-col gap-4">
              <SettingsCard
                title="Current profile"
                detail="Each identity keeps its own history, bookmarks, cookies and settings."
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-400/15 font-mono text-[14px] uppercase text-teal-100">
                    {profileName.slice(0, 1) || 'U'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-ink-100">{profileName}</p>
                    <p className="text-[10px] text-ink-500">Local identity, isolated session</p>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Startup prompt"
                detail="Ask before the browser opens when more than one profile exists."
              >
                <SettingRow
                  label="Ask who is using DevLens on startup"
                  detail="The identity gate appears before browsing starts."
                >
                  <Switch
                    checked={profileAsk}
                    testId="settings-page-ask-on-startup"
                    onChange={onProfileAsk}
                  />
                </SettingRow>
              </SettingsCard>
            </div>
          )}

          {category === 'about' && (
            <AboutSettingsContent
              aboutInfo={aboutInfo}
              preferences={aboutPreferences}
              onAboutChange={onAboutChange}
              onOpenRoute={onOpenAboutRoute}
            />
          )}
          {category === 'downloads' && (
            <DownloadsSettingsContent preferences={downloads} onChange={onDownloads} />
          )}

          <p className="mt-5 font-mono text-[9px] text-ink-600">
            Settings are saved to this profile. No setting is synced or uploaded.
          </p>
        </div>
      </div>
      {iconPickerOpen && (
        <AppIconPicker
          value={appearance.appIcon}
          onChange={(appIcon) => onAppearance({ appIcon })}
          onClose={() => setIconPickerOpen(false)}
        />
      )}
    </div>
  )
}

function SettingsCard({
  title,
  detail,
  children
}: {
  title: string
  detail: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-[var(--devlens-hairline)] bg-white/[0.018]">
      <div className="border-b border-[var(--devlens-hairline)] px-5 py-4">
        <h3 className="text-[14px] font-semibold text-ink-100">{title}</h3>
        <p className="mt-1 text-[11px] leading-5 text-ink-500">{detail}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  detail,
  children
}: {
  label: string
  detail: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] text-ink-200">{label}</p>
        <p className="mt-1 text-[11px] leading-5 text-ink-500">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Segmented({
  value,
  options,
  onChange,
  testId
}: {
  value: string
  options: { value: string; label: string; icon?: ReactNode }[]
  onChange: (value: string) => void
  testId: string
}) {
  return (
    <div
      role="radiogroup"
      data-testid={testId}
      className="flex overflow-hidden rounded-md border border-[var(--devlens-hairline)]"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={[
              'flex min-w-0 flex-1 items-center justify-center gap-2 px-3.5 py-2.5 text-[11px] transition-colors',
              selected
                ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                : 'text-ink-400 hover:bg-white/[0.035] hover:text-ink-200'
            ].join(' ')}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function InfoTile({
  icon,
  label,
  detail
}: {
  icon: ReactNode
  label: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--devlens-hairline)] px-4 py-3.5">
      <span className="mt-0.5 text-[var(--devlens-accent)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] text-ink-200">{label}</span>
        <span className="mt-1 block text-[11px] leading-5 text-ink-500">{detail}</span>
      </span>
    </div>
  )
}

function ShortcutTile({
  label,
  detail,
  onClick
}: {
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--devlens-hairline)] px-4 py-3.5 text-left hover:border-[var(--devlens-accent-line)] hover:bg-white/[0.03]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-ink-200">{label}</span>
        <span className="mt-1 block truncate text-[10px] text-ink-500">{detail}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-ink-500" />
    </button>
  )
}
