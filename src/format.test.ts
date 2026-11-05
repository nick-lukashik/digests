import { describe, expect, it } from 'vitest'
import {
    type Digest,
    escapeHtml,
    formatDay,
    formatDigest,
    formatDuration,
    PEOPLE,
    plural,
    ROWS,
    sourceLabel,
    VIEWS,
    VISITS,
} from './format.js'
import type { MarkedVisit, Source } from './reports.js'

const NOBODY = {
    users: 0,
    sessions: 0,
    averageDuration: 0,
    views: 0,
}

function source(overrides: Partial<Source>): Source {
    return {
        source: 'linkedin',
        medium: 'social',
        campaign: 'post-nextjs',
        sessions: 5,
        averageDuration: 130,
        ...overrides,
    }
}

function visit(overrides: Partial<MarkedVisit> = {}): MarkedVisit {
    return {
        dateHourMinute: '202611041432',
        source: 'google',
        campaign: 'cover-letter',
        city: 'Berlin',
        country: 'Germany',
        device: 'desktop',
        averageDuration: 200,
        ...overrides,
    }
}

function digest(overrides: Partial<Digest> = {}): Digest {
    return {
        date: '2026-11-04',
        totals: {
            users: 9,
            sessions: 12,
            averageDuration: 94,
            views: 31,
        },
        sources: {
            total: 2,
            rows: [
                source({}),
                source({
                    source: '(direct)',
                    medium: '(none)',
                    campaign: '(direct)',
                    sessions: 4,
                    averageDuration: 40,
                }),
            ],
        },
        markedVisits: {
            total: 1,
            rows: [
                visit(),
            ],
        },
        pages: {
            total: 2,
            rows: [
                {
                    path: '/',
                    views: 12,
                },
                {
                    path: '/privacy',
                    views: 2,
                },
            ],
        },
        preliminary: {
            date: '2026-11-05',
            totals: {
                users: 3,
                sessions: 3,
                averageDuration: 50,
                views: 6,
            },
            topSource: source({
                campaign: 'profile',
                sessions: 2,
            }),
        },
        thresholded: false,
        ...overrides,
    }
}

const SHAPE = `📊 <b>Дайджест за 4 ноября</b>
👥 9 человек · 12 визитов · в среднем 1:34
📄 31 просмотр

🔗 <b>Откуда</b>
linkedin / post-nextjs: 5 визитов, 2:10
прямые заходы: 4 визита, 0:40

🎯 <b>По меткам</b>
14:32 cover-letter / google · Berlin, компьютер · 3:20

📄 <b>Страницы</b>
/ 12
/privacy 2

🕐 <b>5 ноября, предварительно:</b> 3 человека, linkedin / profile 2`

describe('plural', () => {
    it.each([
        [
            1,
            '1 человек',
            '1 визит',
            '1 просмотр',
            '1 строка',
        ],
        [
            2,
            '2 человека',
            '2 визита',
            '2 просмотра',
            '2 строки',
        ],
        [
            4,
            '4 человека',
            '4 визита',
            '4 просмотра',
            '4 строки',
        ],
        [
            5,
            '5 человек',
            '5 визитов',
            '5 просмотров',
            '5 строк',
        ],
        [
            11,
            '11 человек',
            '11 визитов',
            '11 просмотров',
            '11 строк',
        ],
        [
            12,
            '12 человек',
            '12 визитов',
            '12 просмотров',
            '12 строк',
        ],
        [
            14,
            '14 человек',
            '14 визитов',
            '14 просмотров',
            '14 строк',
        ],
        [
            21,
            '21 человек',
            '21 визит',
            '21 просмотр',
            '21 строка',
        ],
        [
            22,
            '22 человека',
            '22 визита',
            '22 просмотра',
            '22 строки',
        ],
        [
            100,
            '100 человек',
            '100 визитов',
            '100 просмотров',
            '100 строк',
        ],
        [
            111,
            '111 человек',
            '111 визитов',
            '111 просмотров',
            '111 строк',
        ],
        [
            121,
            '121 человек',
            '121 визит',
            '121 просмотр',
            '121 строка',
        ],
    ])('%i', (count, people, visits, views, rows) => {
        expect(plural(count, PEOPLE)).toBe(people)
        expect(plural(count, VISITS)).toBe(visits)
        expect(plural(count, VIEWS)).toBe(views)
        expect(plural(count, ROWS)).toBe(rows)
    })
})

describe('formatDuration', () => {
    it.each([
        [
            0,
            '0:00',
        ],
        [
            9,
            '0:09',
        ],
        [
            94.4,
            '1:34',
        ],
        [
            59.6,
            '1:00',
        ],
        [
            3599,
            '59:59',
        ],
        [
            3599.6,
            '1:00:00',
        ],
        [
            3725,
            '1:02:05',
        ],
        [
            36_000,
            '10:00:00',
        ],
    ])('%d s is %s', (seconds, expected) => {
        expect(formatDuration(seconds)).toBe(expected)
    })
})

describe('formatDay', () => {
    it.each([
        [
            '2026-01-01',
            '1 января',
        ],
        [
            '2026-02-28',
            '28 февраля',
        ],
        [
            '2026-03-09',
            '9 марта',
        ],
        [
            '2026-04-10',
            '10 апреля',
        ],
        [
            '2026-05-11',
            '11 мая',
        ],
        [
            '2026-06-12',
            '12 июня',
        ],
        [
            '2026-07-13',
            '13 июля',
        ],
        [
            '2026-08-14',
            '14 августа',
        ],
        [
            '2026-09-15',
            '15 сентября',
        ],
        [
            '2026-10-16',
            '16 октября',
        ],
        [
            '2026-11-04',
            '4 ноября',
        ],
        [
            '2026-12-31',
            '31 декабря',
        ],
    ])('%s is %s', (day, expected) => {
        expect(formatDay(day)).toBe(expected)
    })
})

describe('sourceLabel', () => {
    it.each([
        [
            '(direct)',
            '(none)',
            '(direct)',
            'прямые заходы',
        ],
        [
            'google',
            'organic',
            '(organic)',
            'поиск google',
        ],
        [
            'linkedin',
            'social',
            'post-nextjs',
            'linkedin / post-nextjs',
        ],
        [
            'linkedin.com',
            'referral',
            '(referral)',
            'linkedin.com',
        ],
        [
            't.me',
            'referral',
            '(not set)',
            't.me',
        ],
        [
            'example.com',
            'email',
            '(data not available)',
            'example.com',
        ],
    ])('%s, %s, %s reads %s', (sourceName, medium, campaign, expected) => {
        expect(
            sourceLabel(
                source({
                    source: sourceName,
                    medium,
                    campaign,
                }),
            ),
        ).toBe(expected)
    })

    it('reads an unset source with a medium other than (none) as it is', () => {
        expect(
            sourceLabel(
                source({
                    source: '(direct)',
                    medium: 'email',
                    campaign: '(not set)',
                }),
            ),
        ).toBe('(direct)')
    })
})

describe('formatDigest', () => {
    it('renders the agreed shape', () => {
        expect(formatDigest(digest())).toBe(SHAPE)
    })

    it('says nobody came and leaves out the sections on a day without visits', () => {
        expect(
            formatDigest(
                digest({
                    totals: NOBODY,
                    sources: {
                        rows: [],
                        total: 0,
                    },
                    markedVisits: {
                        rows: [],
                        total: 0,
                    },
                    pages: {
                        rows: [],
                        total: 0,
                    },
                }),
            ),
        ).toBe(
            `📊 <b>Дайджест за 4 ноября</b>
Никто не заходил.

🕐 <b>5 ноября, предварительно:</b> 3 человека, linkedin / profile 2`,
        )
    })

    it('says nobody came on an empty preliminary day', () => {
        const message = formatDigest(
            digest({
                preliminary: {
                    date: '2026-11-05',
                    totals: NOBODY,
                },
            }),
        )
        expect(message).toContain('🕐 <b>5 ноября, предварительно:</b> Никто не заходил.')
    })

    it('leaves out the source on a preliminary day without sources', () => {
        const message = formatDigest(
            digest({
                preliminary: {
                    date: '2026-11-05',
                    totals: {
                        ...NOBODY,
                        users: 1,
                    },
                },
            }),
        )
        expect(message.endsWith('🕐 <b>5 ноября, предварительно:</b> 1 человек')).toBe(true)
    })

    it('skips an empty section', () => {
        const message = formatDigest(
            digest({
                markedVisits: {
                    rows: [],
                    total: 0,
                },
            }),
        )
        expect(message).not.toContain('По меткам')
        expect(message).toContain('Откуда')
        expect(message).toContain('Страницы')
    })

    it('adds one line when Google hid rows', () => {
        const message = formatDigest(
            digest({
                thresholded: true,
            }),
        )
        expect(message).toBe(`${SHAPE}\n\n⚠️ Google скрыл часть строк (порог приватности).`)
    })

    it('renders a mobile visit from a country with no city', () => {
        const message = formatDigest(
            digest({
                markedVisits: {
                    total: 1,
                    rows: [
                        visit({
                            city: '(not set)',
                            device: 'mobile',
                        }),
                    ],
                },
            }),
        )
        expect(message).toContain('14:32 cover-letter / google · Germany, телефон · 3:20')
    })

    it('leaves out the place when neither city nor country is set', () => {
        const message = formatDigest(
            digest({
                markedVisits: {
                    total: 1,
                    rows: [
                        visit({
                            city: '(not set)',
                            country: '(not set)',
                            device: 'tablet',
                        }),
                    ],
                },
            }),
        )
        expect(message).toContain('14:32 cover-letter / google · планшет · 3:20')
    })

    it('never turns a value from Google into markup', () => {
        const hostile = '<b onclick="x">&</b>'
        const escaped = '&lt;b onclick=&quot;x&quot;&gt;&amp;&lt;/b&gt;'
        const message = formatDigest(
            digest({
                sources: {
                    total: 1,
                    rows: [
                        source({
                            source: hostile,
                            campaign: hostile,
                        }),
                    ],
                },
                markedVisits: {
                    total: 1,
                    rows: [
                        visit({
                            dateHourMinute: hostile,
                            source: hostile,
                            campaign: hostile,
                            city: hostile,
                            device: hostile,
                        }),
                    ],
                },
                pages: {
                    total: 1,
                    rows: [
                        {
                            path: `/${hostile}`,
                            views: 1,
                        },
                    ],
                },
                preliminary: {
                    date: '2026-11-05',
                    totals: {
                        ...NOBODY,
                        users: 1,
                    },
                    topSource: source({
                        source: hostile,
                        campaign: hostile,
                    }),
                },
            }),
        )
        expect(message).toContain(`${escaped} / ${escaped}: 5 визитов`)
        expect(message).toContain(`/${escaped} 1`)
        expect(message.replaceAll(/<\/?b>/g, '')).not.toMatch(/[<>"]/)
        expect(message).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/)
    })

    it('keeps a line break in a value from making a new line', () => {
        const message = formatDigest(
            digest({
                pages: {
                    total: 1,
                    rows: [
                        {
                            path: '/a\n\n📊 fake',
                            views: 1,
                        },
                    ],
                },
            }),
        )
        expect(message).toContain('/a 📊 fake 1')
    })

    it('escapes through the shared helper', () => {
        expect(escapeHtml('a&b<c>"d"')).toBe('a&amp;b&lt;c&gt;&quot;d&quot;')
    })
})

describe('the 4096 limit', () => {
    const LIMIT = 4096

    /** Ampersands: a value of 100 characters takes 500 once escaped. */
    function longSources(count: number) {
        return {
            total: count,
            rows: Array.from(
                {
                    length: count,
                },
                (_, index) =>
                    source({
                        source: `source-${index}-${'&'.repeat(30)}`,
                        campaign: `campaign-${index}-${'&'.repeat(30)}`,
                    }),
            ),
        }
    }

    it('leaves a message that fits untouched, with no note about cut rows', () => {
        const message = formatDigest(digest())
        expect(message.length).toBeLessThan(LIMIT)
        expect(message).not.toContain('и ещё')
    })

    it('cuts the longest list first and says how many rows are left out', () => {
        const message = formatDigest(
            digest({
                sources: longSources(30),
            }),
        )
        expect(message.length).toBeLessThan(LIMIT)
        const shown = message.split('\n').filter(line => line.startsWith('source-')).length
        expect(shown).toBeGreaterThan(0)
        expect(shown).toBeLessThan(30)
        expect(message).toContain(`… и ещё ${plural(30 - shown, ROWS)}`)
        // The short lists and the preliminary line stay.
        expect(message).toContain('14:32 cover-letter / google')
        expect(message).toContain('/privacy 2')
        expect(message).toContain('предварительно')
    })

    it('counts rows over the request limit among those left out', () => {
        const message = formatDigest(
            digest({
                sources: {
                    ...longSources(30),
                    total: 45,
                },
            }),
        )
        const shown = message.split('\n').filter(line => line.startsWith('source-')).length
        expect(message).toContain(`… и ещё ${plural(45 - shown, ROWS)}`)
    })

    it('does not mention rows over the request limit when nothing was cut', () => {
        const message = formatDigest(
            digest({
                pages: {
                    total: 40,
                    rows: [
                        {
                            path: '/',
                            views: 12,
                        },
                    ],
                },
            }),
        )
        expect(message).not.toContain('и ещё')
    })

    it('fits the worst case: every list full of the longest values, all escaped', () => {
        const worst = '&'.repeat(500)
        const message = formatDigest(
            digest({
                sources: {
                    total: 30,
                    rows: Array.from(
                        {
                            length: 30,
                        },
                        () =>
                            source({
                                source: worst,
                                campaign: worst,
                            }),
                    ),
                },
                markedVisits: {
                    total: 30,
                    rows: Array.from(
                        {
                            length: 30,
                        },
                        () =>
                            visit({
                                source: worst,
                                campaign: worst,
                                city: worst,
                            }),
                    ),
                },
                pages: {
                    total: 8,
                    rows: Array.from(
                        {
                            length: 8,
                        },
                        () => ({
                            path: worst,
                            views: 1,
                        }),
                    ),
                },
                preliminary: {
                    date: '2026-11-05',
                    totals: {
                        ...NOBODY,
                        users: 1,
                    },
                    topSource: source({
                        source: worst,
                        campaign: worst,
                    }),
                },
                thresholded: true,
            }),
        )
        expect(message.length).toBeLessThan(LIMIT)
        expect(message).toContain('предварительно')
        expect(message).toContain('Google скрыл')
        // Rows go whole, an entity is never cut in half.
        expect(message).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/)
    })

    it('never splits a character when it shortens a value', () => {
        const message = formatDigest(
            digest({
                pages: {
                    total: 1,
                    rows: [
                        {
                            path: '🙂'.repeat(150),
                            views: 1,
                        },
                    ],
                },
            }),
        )
        expect(message).toContain(`${'🙂'.repeat(100)}… 1`)
        expect(message.isWellFormed()).toBe(true)
    })
})
