/**
 * Tracker hosts blocked while ghost mode is active.
 *
 * A curated suffix list rather than a full blocklist: it covers analytics, ad networks,
 * session recorders and product telemetry, which is what makes a "clean" anonymous session
 * feel different from a normal one.
 */
export const TRACKER_SUFFIXES: string[] = [
  'doubleclick.net',
  'google-analytics.com',
  'analytics.google.com',
  'googletagmanager.com',
  'googlesyndication.com',
  'googleadservices.com',
  'bat.bing.com',
  'clarity.microsoft.com',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'hotjar.io',
  'fullstory.com',
  'smartlook.com',
  'mouseflow.com',
  'luckyorange.com',
  'segment.io',
  'segment.com',
  'mixpanel.com',
  'amplitude.com',
  'statcounter.com',
  'quantserve.com',
  'scorecardresearch.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'adnxs.com',
  'adsrvr.org',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'moatads.com',
  'doubleverify.com',
  'branch.io',
  'adjust.com',
  'appsflyer.com',
  'nr-data.net',
  'bugsnag.com',
  'raygun.io',
  'mc.yandex.ru',
  'vk.com'
]

/**
 * Second tier, used by the Strict and Extreme protection levels.
 *
 * The base list covers the hosts that are unambiguously in the advertising business. This tier
 * adds the adjacent machinery that fills the same role on most modern sites - beacons, tracking
 * pixels, ad exchanges, session-replay vendors and product telemetry - which is what makes the
 * stricter levels feel different without breaking the page's own first-party code.
 */
export const AGGRESSIVE_TRACKER_SUFFIXES: string[] = [
  'ads.linkedin.com',
  'px.ads.linkedin.com',
  'snap.licdn.com',
  'ads-twitter.com',
  'static.ads-twitter.com',
  'analytics.tiktok.com',
  'ads.tiktok.com',
  'business-api.tiktok.com',
  'tr.snapchat.com',
  'sc-static.net',
  'pixel.facebook.com',
  'cloudflareinsights.com',
  'clicky.com',
  'chartbeat.com',
  'chartbeat.net',
  'parsely.com',
  'cxense.com',
  'gemius.pl',
  'matomo.cloud',
  'piwik.pro',
  'plausible.io',
  'logrocket.com',
  'logrocket.io',
  'sentry-cdn.com',
  'ingest.sentry.io',
  'js.sentry-cdn.com',
  'quantummetric.com',
  'pendo.io',
  'userpilot.com',
  'walkme.com',
  'optimizely.com',
  'vwo.com',
  'visualwebsiteoptimizer.com',
  'crazyegg.com',
  'clicktale.net',
  'onesignal.com',
  'pushengage.com',
  'teads.tv',
  'sharethrough.com',
  'bidswitch.net',
  '33across.com',
  'adform.net',
  'smartadserver.com',
  'advertising.com',
  'ads.yahoo.com',
  'bluekai.com',
  'agkn.com',
  'mathtag.com',
  'simpli.fi',
  'zedo.com',
  'flashtalking.com',
  'serving-sys.com',
  'adsafeprotected.com',
  'iasds01.com',
  'adsymptotic.com',
  'demdex.net',
  'omtrdc.net',
  '2o7.net',
  'everesttech.net',
  'rlcdn.com',
  'crwdcntrl.net'
]

/** Narrower than the base list: just the unambiguous advertising and analytics hosts. */
export function matchesTrackerSuffix(host: string, list: string[]): boolean {
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`))
}

/**
 * Which tier a host belongs to, or null when it is not on either list.
 *
 * The tiers are ordered on purpose: `standard` cancels the base tier and leaves the aggressive
 * one alone, so a stricter level can only ever block *more* than the level below it.
 */
export function trackedHostTier(host: string): 'base' | 'aggressive' | null {
  const normalised = host.trim().toLowerCase()
  if (!normalised) return null
  if (matchesTrackerSuffix(normalised, TRACKER_SUFFIXES)) return 'base'
  if (matchesTrackerSuffix(normalised, AGGRESSIVE_TRACKER_SUFFIXES)) return 'aggressive'
  return null
}
