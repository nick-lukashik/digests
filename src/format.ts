import type { Listing, MarkedVisit, Page, Source, Totals } from './reports.js'

export type Digest = {
    date: string
    totals: Totals
    sources: Listing<Source>
    markedVisits: Listing<MarkedVisit>
    pages: Listing<Page>
    preliminary: {
        date: string
        totals: Totals
        topSource?: Source
    }
    /** A report came back with rows hidden by Google. */
    thresholded: boolean
}

/** Telegram allows 4096 characters; the raw HTML is never shorter than what it counts. */
const MAX_MESSAGE_LENGTH = 4095
/** One visitor's URL cannot take the whole message, so the fixed part always fits. */
const MAX_VALUE_LENGTH = 100

const NO_VISITS = 'Никто не заходил.'
const THRESHOLDED = '⚠️ Google скрыл часть строк (порог приватности).'

const MONTHS = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
]

const DEVICES = new Map([
    [
        'desktop',
        'компьютер',
    ],
    [
        'mobile',
        'телефон',
    ],
    [
        'tablet',
        'планшет',
    ],
])

type PluralForms = readonly [
    one: string,
    few: string,
    many: string,
]

export const PEOPLE: PluralForms = [
    'человек',
    'человека',
    'человек',
]
export const VISITS: PluralForms = [
    'визит',
    'визита',
    'визитов',
]
export const VIEWS: PluralForms = [
    'просмотр',
    'просмотра',
    'просмотров',
]
export const ROWS: PluralForms = [
    'строка',
    'строки',
    'строк',
]

export function plural(count: number, [one, few, many]: PluralForms): string {
    const tens = count % 100
    const units = count % 10
    if (tens >= 11 && tens <= 14) return `${count} ${many}`
    if (units === 1) return `${count} ${one}`
    if (units >= 2 && units <= 4) return `${count} ${few}`
    return `${count} ${many}`
}

/** `m:ss`, or `h:mm:ss` from an hour. */
export function formatDuration(seconds: number): string {
    const total = Math.round(seconds)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const rest = String(total % 60).padStart(2, '0')
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

/** `2026-11-04` reads `4 ноября`. */
export function formatDay(day: string): string {
    const [, month, date] = day.split('-')
    return `${Number(date)} ${MONTHS[Number(month) - 1]}`
}

export function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

/** Every value from Google goes through here: page paths and campaigns come from visitors' URLs. */
function safe(value: string): string {
    const characters = Array.from(value.replace(/\s+/g, ' ').trim())
    const shown =
        characters.length > MAX_VALUE_LENGTH
            ? [
                  ...characters.slice(0, MAX_VALUE_LENGTH),
                  '…',
              ]
            : characters
    return escapeHtml(shown.join(''))
}

/** GA's `(not set)`, `(direct)` and the like. */
function isPlaceholder(value: string): boolean {
    return /^\(.*\)$/.test(value)
}

function isKnown(value: string): boolean {
    return value !== '' && !isPlaceholder(value)
}

export function sourceLabel({ source, medium, campaign }: Source): string {
    if (source === '(direct)' && medium === '(none)') return 'прямые заходы'
    if (medium === 'organic') return `поиск ${source}`
    return isKnown(campaign) ? `${source} / ${campaign}` : source
}

function markedVisitLine(visit: MarkedVisit): string {
    const match = /^\d{8}(\d{2})(\d{2})$/.exec(visit.dateHourMinute)
    const time = match ? `${match[1]}:${match[2]}` : visit.dateHourMinute
    const label = isKnown(visit.source) ? `${visit.campaign} / ${visit.source}` : visit.campaign
    const place = [
        visit.city,
        visit.country,
    ].find(isKnown)
    const device = DEVICES.get(visit.device) ?? (isKnown(visit.device) ? visit.device : undefined)
    const where = [
        place,
        device,
    ]
        .filter(part => part !== undefined)
        .join(', ')
    return [
        `${safe(time)} ${safe(label)}`,
        ...(where
            ? [
                  safe(where),
              ]
            : []),
        formatDuration(visit.averageDuration),
    ].join(' · ')
}

function hasVisits(totals: Totals): boolean {
    return totals.users > 0 || totals.sessions > 0 || totals.views > 0
}

function preliminaryLine({ date, totals, topSource }: Digest['preliminary']): string {
    const title = `🕐 <b>${formatDay(date)}, предварительно:</b>`
    if (!hasVisits(totals)) return `${title} ${NO_VISITS}`
    const source = topSource ? `, ${safe(sourceLabel(topSource))} ${topSource.sessions}` : ''
    return `${title} ${plural(totals.users, PEOPLE)}${source}`
}

type Section = {
    title: string
    lines: string[]
    /** All rows of the list, for the count of those left out. */
    total: number
    cut: boolean
}

function section<T>(title: string, listing: Listing<T>, line: (row: T) => string): Section {
    return {
        title,
        lines: listing.rows.map(line),
        total: listing.total,
        cut: false,
    }
}

function renderSection({ title, lines, total, cut }: Section): string {
    return [
        title,
        ...lines,
        ...(cut
            ? [
                  `… и ещё ${plural(total - lines.length, ROWS)}`,
              ]
            : []),
    ].join('\n')
}

/** Drops rows from the end of the longest list until the message fits, then says how many went. */
function fitMessage(sections: Section[], render: () => string): string {
    let message = render()
    while (message.length > MAX_MESSAGE_LENGTH) {
        const [longest] = sections
            .filter(item => item.lines.length > 0)
            .sort((a, b) => renderSection(b).length - renderSection(a).length)
        if (!longest) break
        longest.lines.pop()
        longest.cut = true
        message = render()
    }
    return message
}

export function formatDigest(digest: Digest): string {
    const title = `📊 <b>Дайджест за ${formatDay(digest.date)}</b>`
    const { totals } = digest
    const visited = hasVisits(totals)
    const head = visited
        ? [
              title,
              `👥 ${plural(totals.users, PEOPLE)} · ${plural(totals.sessions, VISITS)} · в среднем ${formatDuration(totals.averageDuration)}`,
              `📄 ${plural(totals.views, VIEWS)}`,
          ]
        : [
              title,
              NO_VISITS,
          ]
    const sections = visited
        ? [
              section(
                  '🔗 <b>Откуда</b>',
                  digest.sources,
                  row =>
                      `${safe(sourceLabel(row))}: ${plural(row.sessions, VISITS)}, ${formatDuration(row.averageDuration)}`,
              ),
              section('🎯 <b>По меткам</b>', digest.markedVisits, markedVisitLine),
              section('📄 <b>Страницы</b>', digest.pages, row => `${safe(row.path)} ${row.views}`),
          ]
        : []
    const render = () =>
        [
            head.join('\n'),
            ...sections.filter(item => item.lines.length > 0 || item.cut).map(renderSection),
            preliminaryLine(digest.preliminary),
            ...(digest.thresholded
                ? [
                      THRESHOLDED,
                  ]
                : []),
        ].join('\n\n')
    return fitMessage(sections, render)
}
