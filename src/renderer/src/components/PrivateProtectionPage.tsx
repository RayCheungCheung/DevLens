import { ArrowLeft, ArrowUpRight, ShieldCheck, VenetianMask } from 'lucide-react'

type PrivateGuide = 'how' | 'who' | 'whatnhow'
type ProtectionContext = 'private' | 'wimh'

interface PrivateProtectionPageProps {
  guide: PrivateGuide
  context: ProtectionContext
  onBack: () => void
  onOpenGuide: (guide: PrivateGuide) => void
}

interface GuideSection {
  title: string
  paragraphs: string[]
}

const HOW_SECTIONS: GuideSection[] = [
  {
    title: 'An isolated session',
    paragraphs: [
      'Private tabs and WImH sessions never share their browsing data with your normal DevLens profiles. Cookies, localStorage, sessions, IndexedDB and cache live in a session created for this protected context.',
      'For a private tab, DevLens creates a dedicated in-memory session. For WImH, the viewports are moved to a RAM-only partition.'
    ]
  },
  {
    title: 'History stays out of the profile',
    paragraphs: [
      'Private visits are not written into the active profile\'s history, recent pages or saved session. WImH also marks history writes for the protected session as blocked.',
      'The ordinary DevLens profile remains untouched when the protected session ends.'
    ]
  },
  {
    title: 'Network and tracker reduction',
    paragraphs: [
      'Requests in a protected session pass through the DevLens protection pipeline. Known tracking hosts can be cancelled before the request leaves the browser, and configured header rules can reduce unnecessary identifying information.',
      'WImH applies its RAM-only session policy for the entire lifetime of the protected window. Ghost mode additionally applies its tracker blocklist before ordinary interception rules.'
    ]
  },
  {
    title: 'Clipboard and paste protection',
    paragraphs: [
      'WImH can classify pasted text before it reaches a page, refuse likely secrets, purge copied secrets after a timeout, and clear protected scratch values when the session ends.',
      'These safeguards reduce accidental exposure inside the browser. They cannot control what another application does with data already copied outside DevLens.'
    ]
  },
  {
    title: 'Closing wipes the session',
    paragraphs: [
      'When a private tab closes, DevLens wipes the tab\'s dedicated session. When WImH or Ghost ends, the in-memory session is cleared and its cache is discarded.',
      'Nothing from that session is intentionally restored on the next launch. The normal profile does not inherit its cookies or storage.'
    ]
  },
  {
    title: 'Strong protection is not invisibility',
    paragraphs: [
      'DevLens uses the strongest isolation available inside its own architecture, but no browser can guarantee complete anonymity. A website can still know what you choose to send it, and your network can still see that a connection happened.',
      'For maximum privacy, avoid signing in, do not submit identifying information, use a trusted network, and close the protected tab when you finish.'
    ]
  }
]

const WHO_SECTIONS: GuideSection[] = [
  {
    title: 'Your network operator',
    paragraphs: [
      'An internet provider, school network, workplace network or public Wi-Fi operator can usually see connection metadata such as the destination host, timing and traffic volume. HTTPS protects request and response contents, not the fact that a connection exists.',
      'DevLens cannot hide your connection from the infrastructure carrying it.'
    ]
  },
  {
    title: 'Websites you visit',
    paragraphs: [
      'A site receives your IP address, request headers, browser characteristics and anything you submit. If you sign in or use a site account, that service can associate the visit with your identity even when the DevLens tab is private.',
      'Private mode does not make an account anonymous to the provider that owns it.'
    ]
  },
  {
    title: 'DNS and network services',
    paragraphs: [
      'A DNS resolver can see domain lookups even when page contents use HTTPS. Your configured resolver, VPN, proxy or network gateway may retain those records under its own policy.',
      'DevLens can apply the resolver mode configured in Privacy settings, but it cannot control the logging policy of an external resolver.'
    ]
  },
  {
    title: 'Your device and operating system',
    paragraphs: [
      'The operating system, system administrators, security software, screen capture tools or malware with sufficient privileges may observe applications and network traffic outside DevLens.',
      'WImH reduces what DevLens and ordinary pages retain, but it does not replace an operating-system or endpoint security review.'
    ]
  },
  {
    title: 'Extensions and developer tools',
    paragraphs: [
      'Code running with browser or DevTools privileges can inspect the page, execute JavaScript, read network events and capture screenshots. Open an external DevTools window only when you trust the tools and the people who can access that window.',
      'The embedded DevLens tools are scoped to the active guest, but they are still powerful debugging surfaces.'
    ]
  },
  {
    title: 'Services that receive submitted data',
    paragraphs: [
      'Search providers, login providers, calendars, AI services and other remote destinations receive whatever you intentionally submit to them. Their own terms, logs and retention policies apply.',
      'Closing the DevLens session can erase local state; it cannot retract data a third party has already received.'
    ]
  }
]

const WIMH_HOW_SECTIONS: GuideSection[] = [
  {
    title: 'What WImH means in DevLens',
    paragraphs: [
      'WImH is DevLens\'s extreme defense mode. It is designed for sessions where you want the strongest local isolation the browser can provide, together with deliberate clipboard and history controls.',
      'WImH is a full browser-session policy, not a cosmetic private icon. The mode changes the partition, protection behavior and cleanup lifecycle of the pages you open.'
    ]
  },
  {
    title: 'RAM-only browsing session',
    paragraphs: [
      'WImH moves the viewports to a dedicated in-memory partition. Its cookies and site storage are not placed in the normal persistent profile, and the partition is created with cache disabled.',
      'This limits data left on disk, but it does not prevent a page from sending information to a remote service while the session is open.'
    ]
  },
  {
    title: 'Clipboard sentinel',
    paragraphs: [
      'WImH can classify pasted text, refuse likely credentials or secrets, purge sensitive clipboard values after a timeout, and scrub protected scratch memory when the session exits.',
      'Clipboard protection only covers actions visible to DevLens. Other applications on the device may retain their own clipboard or document history.'
    ]
  },
  {
    title: 'History and cache refusal',
    paragraphs: [
      'WImH blocks protected-session history writes and keeps its browsing records out of the normal profile. When the session ends, DevLens clears the session storage and cache it controls.',
      'An external service can still retain its own access logs for requests it received.'
    ]
  },
  {
    title: 'Private + WImH together',
    paragraphs: [
      'When a private tab is opened while WImH is active, both protections apply. The tab retains its dedicated private session while the WImH policy adds RAM-only storage, clipboard controls and history refusal.',
      'The landing page labels this combination as Private + WImH so the active protections are explicit.'
    ]
  },
  {
    title: 'What WImH does not claim',
    paragraphs: [
      'WImH does not turn DevLens into a VPN, Tor client or anonymous identity service. Your IP address, network metadata and information submitted to sites still leave the device.',
      'For the strongest result, use WImH with a private tab, avoid signing in, do not submit identifying data, and close the protected session as soon as you finish.'
    ]
  }
]

const WIMH_WHO_SECTIONS: GuideSection[] = [
  {
    title: 'Network providers',
    paragraphs: [
      'Your ISP, school network, workplace gateway or VPN provider can observe destination hosts, timing and traffic volume. HTTPS protects payload contents but not all connection metadata.',
      'WImH does not alter this network-level visibility.'
    ]
  },
  {
    title: 'Sites you intentionally contact',
    paragraphs: [
      'Every site receives your IP address, headers and anything you submit. Signing into an account immediately links the protected visit to that identity.',
      'A private or WImH session cannot make an authenticated account anonymous to the service that owns it.'
    ]
  },
  {
    title: 'DNS, proxy and security infrastructure',
    paragraphs: [
      'DNS resolvers and enterprise security gateways may retain lookups or connection records. DevLens can apply the chosen DNS mode, but it cannot control an external provider\'s retention policy.',
      'If the device is managed by an organisation, that organisation may have additional monitoring.'
    ]
  },
  {
    title: 'The operating system and other apps',
    paragraphs: [
      'System security software, screen capture tools, backup agents and malware with sufficient privileges can observe activity outside DevLens.',
      'Clipboard scrubbing inside WImH does not erase copies retained by another application or by the operating system.'
    ]
  },
  {
    title: 'DevTools and debugging surfaces',
    paragraphs: [
      'Anyone with access to the open DevLens window or its embedded/external DevTools can inspect pages and execute code. WImH protects session storage; it does not lock the current operator out of the debugging tools.',
      'Close DevTools and lock the device when you leave a WImH session unattended.'
    ]
  },
  {
    title: 'Third-party data submissions',
    paragraphs: [
      'Search providers, AI services, calendars and login providers receive the data you choose to submit. Their logs and retention policies apply after the request leaves DevLens.',
      'Ending WImH can erase local state, but it cannot retract information already accepted by a third party.'
    ]
  }
]

export function PrivateProtectionPage({
  guide,
  context,
  onBack,
  onOpenGuide
}: PrivateProtectionPageProps) {
  const sections =
    context === 'wimh'
      ? guide === 'how' || guide === 'whatnhow'
        ? WIMH_HOW_SECTIONS
        : WIMH_WHO_SECTIONS
      : guide === 'how'
        ? HOW_SECTIONS
        : WHO_SECTIONS
  const otherGuide: PrivateGuide = guide === 'who' ? 'how' : 'who'
  const title =
    context === 'wimh'
      ? guide === 'whatnhow'
        ? 'What and How WImH protects you?'
        : guide === 'how'
        ? 'What is WImH and how does it protect me?'
        : 'What can WImH not hide from the network?'
      : guide === 'how'
        ? 'How DevLens protects me?'
        : 'Who might still be able to see my activity?'
  const intro =
    context === 'wimh'
      ? guide === 'whatnhow'
        ? 'WImH combines memory-only browsing, clipboard safeguards, history refusal and protected-session cleanup. This guide explains both what the mode does and how each protection operates.'
        : guide === 'how'
        ? 'WImH is DevLens\'s extreme defense mode. It combines a RAM-only session, clipboard safeguards, history refusal and protected-session cleanup. It can also operate together with a private tab.'
        : 'WImH removes local traces controlled by DevLens, but it cannot make every network participant anonymous. This guide lists what remains visible outside the browser.'
      : guide === 'how'
        ? 'DevLens applies every available protection to this private session. The sections below describe what is enforced, what is erased, and where the technical boundary lies.'
        : 'Private browsing removes local traces, but it cannot make every part of the network anonymous. This guide lists the parties that may still observe a private session.'
  const otherLabel =
    context === 'wimh'
      ? otherGuide === 'how'
        ? 'What is WImH and how does it protect me?'
        : 'What can WImH not hide from the network?'
      : otherGuide === 'how'
        ? 'How DevLens protects me?'
        : 'Who might still see my activity?'

  return (
    <div
      className="private-session-surface absolute inset-0 z-40 overflow-y-auto"
      data-testid={`private-guide-${guide}`}
    >
      <div className="mx-auto w-full max-w-[1040px] px-10 py-9">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[10px] text-ink-300 hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
        >
          <ArrowLeft size={12} />
          Back to protected session
        </button>

        <header className="mt-8 max-w-[760px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--devlens-accent)]">
            {guide === 'how' || guide === 'whatnhow' ? (
              <ShieldCheck size={12} />
            ) : (
              <VenetianMask size={12} />
            )}
            {context === 'wimh'
              ? guide === 'whatnhow'
                ? 'WImH capabilities'
                : 'WImH defense guide'
              : 'Private session guide'}
          </span>
          <h1 className="mt-4 text-[34px] font-semibold leading-tight text-ink-100">
            {title}
          </h1>
          <p className="mt-3 text-[13px] leading-7 text-ink-300">
            {intro}
          </p>
        </header>

        <div className="mt-8 grid gap-3">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className="grid gap-3 border-b border-[var(--devlens-hairline)] py-5 last:border-b-0 sm:grid-cols-[48px_minmax(0,1fr)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] font-mono text-[10px] text-[var(--devlens-accent)]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h2 className="text-[14px] font-semibold text-ink-100">{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-[11px] leading-6 text-ink-400">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--devlens-hairline)] pt-5">
          <p className="max-w-[620px] text-[10px] leading-5 text-ink-500">
            {context === 'wimh'
              ? 'WImH reduces local retention and adds defense controls, but its limits still depend on the site, account, network and device in use.'
              : 'DevLens will do its part to minimise local retention and exposure, but privacy also depends on the site, account, network and device in use.'}
          </p>
          <button
            type="button"
            onClick={() => onOpenGuide(otherGuide)}
            className="inline-flex items-center gap-1.5 text-[11px] text-[var(--devlens-accent)] underline decoration-[var(--devlens-accent-line)] underline-offset-4"
          >
            {otherLabel}
            <ArrowUpRight size={12} />
          </button>
        </footer>
      </div>
    </div>
  )
}
