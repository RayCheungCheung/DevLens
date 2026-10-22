export const languages = [
  ['en', 'English', 'README.md'],
  ['zh-CN', '简体中文', 'README_zh-CN.md'],
  ['zh-TW', '繁體中文', 'README_zh-TW.md'],
  ['ko', '한국어', 'README_ko.md'],
  ['de', 'Deutsch', 'README_de.md'],
  ['es', 'Español', 'README_es.md'],
  ['fr', 'Français', 'README_fr.md'],
  ['it', 'Italiano', 'README_it.md'],
  ['da', 'Dansk', 'README_da.md'],
  ['ja', '日本語', 'README_ja.md'],
  ['pl', 'Polski', 'README_pl.md'],
  ['ru', 'Русский', 'README_ru.md'],
  ['bs', 'Bosanski', 'README_bs.md'],
  ['ar', 'العربية', 'README_ar.md'],
  ['no', 'Norsk', 'README_no.md'],
  ['pt-BR', 'Português (Brasil)', 'README_pt-BR.md'],
  ['th', 'ไทย', 'README_th.md'],
  ['tr', 'Türkçe', 'README_tr.md'],
  ['uk', 'Українська', 'README_uk.md'],
  ['bn', 'বাংলা', 'README_bn.md'],
  ['el', 'Ελληνικά', 'README_el.md'],
  ['vi', 'Tiếng Việt', 'README_vi.md']
]

export function languageNavigation(rootHref) {
  const items = languages.map(([code, label, href]) => {
    const target = code === 'en' ? rootHref : href
    return `[${label}](${target})`
  })
  return `<div align="center">\n\n${items.join(' | ')}\n\n</div>`
}

export function renderLocaleReadme(locale) {
  const rows = locale.shortcuts.map(([action, keys]) => `| ${action} | \`${keys}\` |`).join('\n')
  const scripts = locale.scripts.map(([script, description]) => `| \`${script}\` | ${description} |`).join('\n')
  const features = locale.features.map((feature) => `- ${feature}`).join('\n')
  const stack = locale.stack.map((entry) => `- ${entry}`).join('\n')
  const rtlOpen = locale.rtl ? '<div dir="rtl">\n' : ''
  const rtlClose = locale.rtl ? '\n</div>' : ''

  return `${rtlOpen}# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

${locale.intro}

${locale.introDetail}

## ${locale.headings.features}

${features}

## ${locale.headings.techStack}

${stack}

## ${locale.headings.gettingStarted}

${locale.gettingStarted}

| ${locale.tableHeaders.script} | ${locale.tableHeaders.description} |
| --- | --- |
${scripts}

## ${locale.headings.shortcuts}

| ${locale.tableHeaders.action} | ${locale.tableHeaders.shortcut} |
| --- | --- |
${rows}

## ${locale.headings.license}

${locale.license}

## ${locale.headings.contributing}

${locale.contributing}
${rtlClose}
`
}
