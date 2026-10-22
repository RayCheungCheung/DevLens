import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  ShieldCheck
} from 'lucide-react'
import type { GoogleOAuthStatus } from '@shared/types'

/**
 * Google account state for the public PKCE flow.
 *
 * The component never receives an access token. Main owns the encrypted token store and sends
 * only account metadata to the renderer, keeping credentials out of React state and DevTools.
 */
export function GoogleAccountSettings() {
  const [status, setStatus] = useState<GoogleOAuthStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.devlens.googleAuthStatus().then((next) => {
      if (active) setStatus(next)
    })
    const unsubscribe = window.devlens.onGoogleAuthChanged((next) => {
      setStatus(next)
      if (next.signedIn) setNotice('Google account connected.')
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const signIn = async (): Promise<void> => {
    setBusy(true)
    setNotice('Finish signing in through the system browser.')
    const result = await window.devlens.googleAuthStart()
    if (!result.ok) setNotice(result.error ?? 'Could not start Google sign-in.')
    setBusy(false)
  }

  const signOut = async (): Promise<void> => {
    setBusy(true)
    const next = await window.devlens.googleAuthLogout()
    setStatus(next)
    setNotice('Google account disconnected from this device.')
    setBusy(false)
  }

  const configured = status?.configured === true
  const signedIn = status?.signedIn === true

  return (
    <section
      data-testid="google-account-settings"
      className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018]"
    >
      <div className="flex items-start gap-3 border-b border-[var(--devlens-hairline)] px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]">
          {signedIn ? <CheckCircle2 size={15} /> : <ShieldCheck size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12px] font-medium text-ink-100">Google account</h3>
          <p className="mt-0.5 text-[10px] leading-4 text-ink-500">
            OAuth Authorization Code + PKCE, completed in your system browser.
          </p>
        </div>
        {signedIn ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void signOut()}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[10px] text-ink-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-40"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
            Sign out
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !configured}
            onClick={() => void signIn()}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-2.5 text-[10px] text-[var(--devlens-accent)] hover:bg-[var(--devlens-accent)] hover:text-ink-950 disabled:cursor-not-allowed disabled:border-[var(--devlens-hairline)] disabled:bg-transparent disabled:text-ink-600"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
            Sign in
          </button>
        )}
      </div>

      <div className="space-y-2 px-4 py-3">
        {signedIn ? (
          <>
            <p className="truncate text-[11px] text-ink-200">
              {status?.name || status?.email || 'Google account connected'}
            </p>
            {status?.email && status.name && (
              <p className="truncate font-mono text-[9px] text-ink-500">{status.email}</p>
            )}
          </>
        ) : (
          <p className="text-[10px] leading-4 text-ink-400">
            Google sign-in opens outside DevLens. The returned authorization code is exchanged in
            the main process and the refresh token is encrypted with Electron safeStorage.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 font-mono text-[8px] text-ink-600">
          <span className="rounded border border-[var(--devlens-hairline)] px-1.5 py-1">
            {configured ? 'OAuth configured' : 'OAuth client not configured'}
          </span>
          <span className="rounded border border-[var(--devlens-hairline)] px-1.5 py-1">
            {status?.storage === 'encrypted'
              ? 'Token encrypted'
              : status?.storage === 'memory'
                ? 'Memory only'
                : 'No token'}
          </span>
          {status?.redirectUri && <span className="truncate">{status.redirectUri}</span>}
        </div>

        {!configured && (
          <p className="text-[9px] leading-4 text-amber-200/80">
            Set <code>oauth.google.clientId</code> in <code>devlens.config.json</code> and register
            the same redirect URI in Google Cloud Console.
          </p>
        )}
        {(notice || status?.error) && (
          <p
            role="status"
            className={[
              'text-[9px] leading-4',
              status?.error ? 'text-rose-300' : 'text-[var(--devlens-accent)]'
            ].join(' ')}
          >
            {status?.error ?? notice}
          </p>
        )}
      </div>
    </section>
  )
}
