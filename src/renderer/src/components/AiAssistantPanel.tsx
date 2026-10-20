import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Clipboard,
  ExternalLink,
  Loader2,
  LogIn,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { aiPartition, aiSite, type AiSiteId } from '@shared/ai-sites'
import type { AiContextChip } from '@shared/types'
import type { DevLensWebviewElement } from '@renderer/types/webview-element'
import { AiProviderSelect } from '@renderer/components/AiProviderSelect'

interface AiAssistantPanelProps {
  /** The provider the profile last used; the dock shows the same thing. */
  provider: AiSiteId
  onProviderChange: (provider: AiSiteId) => void
  /** Context the shell captured for the page in front - it goes into the prompt. */
  chips: AiContextChip[]
  activeUrl: string
  activeTitle?: string
  /** Whose AI sessions these are. */
  profileId: string
  onNotice: (message: string) => void
}

/**
 * What "Summarise page" asks, with whatever context the shell attached.
 *
 * Pure and exported so the shape of the prompt can be reasoned about (and checked) without a
 * panel around it.
 */
export function buildSummarisePrompt(input: {
  url: string
  title?: string
  chips?: AiContextChip[]
}): string {
  const chips = input.chips ?? []
  const head = input.url
    ? `Summarise ${input.title ? `"${input.title}" ` : ''}(${input.url}) for a developer.`
    : 'Summarise the page that is currently open for a developer.'
  const ask =
    'Give me: what the page is for, the parts worth knowing before touching it, and anything in the attached context that looks wrong or fragile.'
  const attached = chips.length
    ? `\n\nAttached context:\n${chips.map((chip) => `- ${chip.label}`).join('\n')}`
    : ''
  return `${head}\n\n${ask}${attached}`
}

/**
 * The script that puts a prompt into the site's own composer.
 *
 * The assistant panel is a *web* assistant: the conversation belongs to the provider's page, so
 * the prompt goes where a person would type it rather than to an API behind their back. The
 * composer is found the way a person finds it - the biggest editable thing on the page - and the
 * text is set through the native setter so the site's own framework notices the change. Nothing
 * is sent: the operator reads it and presses their own Enter.
 */
function injectionScript(text: string): string {
  return `(() => {
    const text = ${JSON.stringify(text)}
    const area = (element) => {
      const box = element.getBoundingClientRect()
      return box.width * box.height
    }
    const candidates = Array.from(
      document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]')
    ).filter((element) => {
      if (element.disabled || element.readOnly) return false
      const box = element.getBoundingClientRect()
      return box.width > 60 && box.height > 12 && area(element) > 0
    })
    if (candidates.length === 0) return 'no-composer'
    const target = candidates.sort((left, right) => area(right) - area(left))[0]
    target.focus()
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      const prototype = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value')?.set
      if (setter) setter.call(target, text)
      else target.value = text
      target.dispatchEvent(new Event('input', { bubbles: true }))
      return 'injected'
    }
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(target)
    selection?.removeAllRanges()
    selection?.addRange(range)
    const inserted = document.execCommand('insertText', false, text)
    return inserted ? 'injected' : 'no-composer'
  })()`
}

/**
 * The AI assistant.
 *
 * One half, deliberately: the provider's own chat, embedded, so the account, the history and the
 * model choice are the official web UI's. DevLens contributes two things and no third - the
 * partition that keeps each provider (and each profile) apart, and "Summarise page", which
 * composes a prompt about the page in front, copies it, and types it into the composer if it can
 * find one. There is no built-in model and no second transcript: this panel is a window onto the
 * site, not a competitor to it.
 */
export function AiAssistantPanel({
  provider,
  onProviderChange,
  chips,
  activeUrl,
  activeTitle = '',
  profileId,
  onNotice
}: AiAssistantPanelProps) {
  const site = aiSite(provider)
  const partition = aiPartition(profileId, site.id)
  const guestRef = useRef<DevLensWebviewElement | null>(null)
  const [injecting, setInjecting] = useState(false)

  const prompt = useMemo(
    () => buildSummarisePrompt({ url: activeUrl, title: activeTitle, chips }),
    [activeTitle, activeUrl, chips]
  )

  const copyPrompt = useCallback(() => {
    void window.devlens.clipboardWrite(prompt).then((ok) =>
      onNotice(
        ok
          ? `prompt copied - paste it into ${site.label}, or press Summarise page again`
          : 'could not reach the clipboard'
      )
    )
  }, [onNotice, prompt, site.label])

  const openSignInWindow = useCallback(async () => {
    const result = await window.devlens
      .aiOpenSignInWindow({ provider: site.id, partition })
      .catch(() => ({ ok: false, error: 'Could not open the sign-in window.' }))
    onNotice(
      result.ok
        ? `sign-in window opened for ${site.label} - finish there, then reload this panel`
        : result.error ?? 'Could not open the sign-in window.'
    )
  }, [onNotice, partition, site.id, site.label])

  const reloadProvider = useCallback(() => {
    guestRef.current?.reload()
    onNotice(`reloading ${site.label}`)
  }, [onNotice, site.label])

  /**
   * "Summarise page".
   *
   * Two destinations, in order of how much the operator has to do afterwards: the site's own
   * composer (they press Enter), or the clipboard (they paste). The clipboard always gets it -
   * a site that has not finished loading is not a reason to lose the prompt.
   */
  const summarise = useCallback(async () => {
    if (!activeUrl) {
      onNotice('open a page first - there is nothing to summarise')
      return
    }
    setInjecting(true)
    const copied = await window.devlens.clipboardWrite(prompt).catch(() => false)
    let injected = false
    try {
      const guest = guestRef.current
      if (guest) {
        const result = await guest.executeJavaScript(injectionScript(prompt))
        injected = result === 'injected'
      }
    } catch {
      /* the guest may not be attached yet, or may refuse the script: the clipboard still has it */
    } finally {
      setInjecting(false)
    }

    if (injected) {
      onNotice(`prompt typed into ${site.label} - press Enter there to send it`)
      return
    }
    onNotice(
      copied
        ? `prompt copied - ${site.label} had no composer to type into yet, so paste it`
        : `could not reach ${site.label}'s composer or the clipboard`
    )
  }, [activeUrl, onNotice, prompt, site.label])

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="ai-panel" data-provider={site.id}>
      {/* ---------------- header: which provider, and the one action ---------------- */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--devlens-hairline)] px-2.5 py-2">
        <AiProviderSelect
          value={site.id}
          onChange={onProviderChange}
        />

        <button
          type="button"
          data-testid="ai-summarise"
          onClick={() => void summarise()}
          disabled={injecting || !activeUrl}
          title={
            activeUrl
              ? `Copy a prompt about ${activeUrl} and type it into ${site.label}`
              : 'open a page to summarise'
          }
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-2 text-[11px] text-[var(--devlens-accent)] transition-colors hover:bg-[var(--devlens-accent)] hover:text-ink-950 disabled:cursor-not-allowed disabled:border-[var(--devlens-hairline)] disabled:bg-transparent disabled:text-ink-600"
        >
          {injecting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Summarise page
        </button>
        <button
          type="button"
          aria-label="Copy the page prompt"
          title="Copy a prompt about this page without typing it into the site"
          onClick={copyPrompt}
          disabled={!activeUrl}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--devlens-hairline)] text-ink-400 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-100 disabled:cursor-not-allowed disabled:text-ink-700"
        >
          <Clipboard size={12} />
        </button>
      </div>

      {/* ---------------- the site, and nothing else ---------------- */}
      <div className="relative min-h-0 flex-1">
        <webview
          key={`${site.id}-${partition}`}
          ref={guestRef}
          data-testid="ai-webview"
          data-site={site.id}
          partition={partition}
          src={site.url}
          title={`${site.label} in DevLens`}
          className="absolute inset-0 h-full w-full"
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--devlens-hairline)] px-2.5 py-2">
        <p className="flex min-w-0 items-center gap-1 font-mono text-[9px] text-ink-600">
          <ExternalLink size={9} className="shrink-0" />
          <span className="truncate">{site.host} runs in its own partition</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="ai-reload-provider"
            aria-label="Reload AI provider"
            title="Reload this provider after signing in"
            onClick={reloadProvider}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-white/[0.05] hover:text-ink-200"
          >
            <RefreshCw size={11} />
          </button>
          <button
            type="button"
            data-testid="ai-open-signin"
            title="Google blocks OAuth inside embedded pages; sign in in a separate window and reload this panel"
            onClick={() => void openSignInWindow()}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[10px] text-ink-400 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
          >
            <LogIn size={10} />
            Sign in separately
          </button>
        </div>
      </div>
    </div>
  )
}
