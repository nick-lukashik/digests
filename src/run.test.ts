import { createVerify, generateKeyPairSync } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { run } from './run.js'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
    },
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
    },
})

const BOT_TOKEN = '123456:TEST-bot-token'
const ACCESS_TOKEN = 'test-access-token'
const TOKEN_URI = 'https://oauth2.googleapis.com/token'
const REPORT_URL = 'https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport'
const TELEGRAM_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
const CLIENT_EMAIL = 'digests@example.iam.gserviceaccount.com'
// 12:00 in Tbilisi on 6 November.
const NOW = new Date('2026-11-06T08:00:00Z')

const ENV = {
    GA_PROPERTY_ID: '123456789',
    GA_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: CLIENT_EMAIL,
        private_key: privateKey,
        token_uri: TOKEN_URI,
    }),
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    TELEGRAM_CHAT_ID: '-1001234567890',
    TELEGRAM_TOPIC_ID: '5',
}

type ReportBody = {
    dateRanges: {
        startDate: string
        endDate: string
    }[]
    dimensions?: {
        name: string
    }[]
    metrics: {
        name: string
    }[]
    dimensionFilter?: unknown
    limit?: number
}

type Call = {
    url: string
    init: RequestInit
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json',
        },
    })
}

function names(...values: string[]) {
    return values.map(name => ({
        name,
    }))
}

function cells(values: string[]) {
    return values.map(value => ({
        value,
    }))
}

function totalsReport(
    values: [
        string,
        string,
        string,
        string,
    ],
) {
    return {
        metricHeaders: names('activeUsers', 'sessions', 'averageSessionDuration', 'screenPageViews'),
        rows: [
            {
                metricValues: cells(values),
            },
        ],
        rowCount: 1,
    }
}

function sourcesReport(
    rows: [
        string,
        string,
        string,
        string,
        string,
    ][],
) {
    return {
        dimensionHeaders: names('sessionSource', 'sessionMedium', 'sessionCampaignName'),
        metricHeaders: names('sessions', 'averageSessionDuration'),
        rows: rows.map(row => ({
            dimensionValues: cells(row.slice(0, 3)),
            metricValues: cells(row.slice(3)),
        })),
        rowCount: rows.length,
    }
}

function marked(rows: string[][]) {
    return {
        dimensionHeaders: names(
            'dateHourMinute',
            'sessionSource',
            'sessionCampaignName',
            'city',
            'country',
            'deviceCategory',
        ),
        metricHeaders: names('sessions', 'averageSessionDuration'),
        rows: rows.map(row => ({
            dimensionValues: cells(row.slice(0, 6)),
            metricValues: cells(row.slice(6)),
        })),
        rowCount: rows.length,
    }
}

function pagesReport(
    rows: [
        string,
        string,
    ][],
) {
    return {
        dimensionHeaders: names('pagePath'),
        metricHeaders: names('screenPageViews'),
        rows: rows.map(([path, views]) => ({
            dimensionValues: cells([
                path,
            ]),
            metricValues: cells([
                views,
            ]),
        })),
        rowCount: rows.length,
    }
}

const FULL_DAY = '2026-11-04'
const PRELIMINARY_DAY = '2026-11-05'

/** Answers like Google for the full day and the preliminary day. */
function reportFor(body: ReportBody): unknown {
    const day = body.dateRanges[0]?.startDate
    const first = body.dimensions?.[0]?.name
    if (day === PRELIMINARY_DAY) {
        return first === 'sessionSource'
            ? sourcesReport([
                  [
                      'linkedin',
                      'social',
                      'profile',
                      '2',
                      '50',
                  ],
              ])
            : totalsReport([
                  '3',
                  '3',
                  '50',
                  '6',
              ])
    }
    switch (first) {
        case 'sessionSource':
            return sourcesReport([
                [
                    'linkedin',
                    'social',
                    'post-nextjs',
                    '5',
                    '130',
                ],
                [
                    '(direct)',
                    '(none)',
                    '(direct)',
                    '4',
                    '40',
                ],
            ])
        case 'dateHourMinute':
            return marked([
                [
                    '202611041432',
                    'google',
                    'cover-letter',
                    'Berlin',
                    'Germany',
                    'desktop',
                    '1',
                    '200',
                ],
            ])
        case 'pagePath':
            return pagesReport([
                [
                    '/',
                    '12',
                ],
                [
                    '/<b>&x=1',
                    '2',
                ],
            ])
        default:
            return totalsReport([
                '9',
                '12',
                '94',
                '31',
            ])
    }
}

/** A stubbed fetch: each route can be replaced to make that request fail. */
function stubFetch(
    routes: { token?: () => Response; report?: (body: ReportBody) => Response; telegram?: () => Response } = {},
) {
    const calls: Call[] = []
    const fetchStub = vi.fn(async (url: string, init: RequestInit) => {
        calls.push({
            url,
            init,
        })
        if (url === TOKEN_URI) {
            return (
                routes.token?.()
                ?? json({
                    access_token: ACCESS_TOKEN,
                    expires_in: 3600,
                    token_type: 'Bearer',
                })
            )
        }
        if (url === REPORT_URL) {
            const body: ReportBody = JSON.parse(String(init.body))
            return routes.report?.(body) ?? json(reportFor(body))
        }
        if (url === TELEGRAM_URL) {
            return (
                routes.telegram?.()
                ?? json({
                    ok: true,
                    result: {
                        message_id: 1,
                    },
                })
            )
        }
        throw new Error('unexpected request')
    })
    vi.stubGlobal('fetch', fetchStub)
    return calls
}

let output = ''

function exec(extraEnv: NodeJS.ProcessEnv = {}) {
    return run(
        {
            ...ENV,
            ...extraEnv,
        },
        NOW,
        line => {
            output += line
        },
    )
}

function logLines(): Record<string, unknown>[] {
    return output
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
}

function expectNoSecretInOutput() {
    for (const secret of [
        BOT_TOKEN,
        ACCESS_TOKEN,
        privateKey,
        'BEGIN PRIVATE KEY',
        'api.telegram.org',
    ]) {
        expect(output).not.toContain(secret)
    }
}

function callsTo(calls: Call[], url: string) {
    return calls.filter(call => call.url === url)
}

function reportBodies(calls: Call[]): ReportBody[] {
    return callsTo(calls, REPORT_URL).map(call => JSON.parse(String(call.init.body)))
}

function telegramBody(calls: Call[]) {
    const [call] = callsTo(calls, TELEGRAM_URL)
    return JSON.parse(String(call?.init.body))
}

beforeEach(() => {
    output = ''
})

describe('a successful run', () => {
    it('exits with 0 and logs JSON lines without the message', async () => {
        const calls = stubFetch()
        await expect(exec()).resolves.toBe(0)
        expect(calls).toHaveLength(1 + 6 + 1)
        const lines = logLines()
        expect(lines).toEqual([
            {
                level: 'info',
                time: expect.any(String),
                service: 'digests',
                msg: 'Digest sent',
                date: FULL_DAY,
                preliminaryDate: PRELIMINARY_DAY,
            },
        ])
        expectNoSecretInOutput()
        expect(output).not.toContain('linkedin')
    })

    it('signs the token request so that the public key verifies it', async () => {
        const calls = stubFetch()
        await exec()
        const [call] = callsTo(calls, TOKEN_URI)
        expect(call?.init.method).toBe('POST')
        expect(call?.init.headers).toMatchObject({
            'content-type': 'application/x-www-form-urlencoded',
        })
        const form = new URLSearchParams(String(call?.init.body))
        expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')

        const [header, payload, signature] = (form.get('assertion') ?? '').split('.')
        const verified = createVerify('RSA-SHA256')
            .update(`${header}.${payload}`)
            .verify(publicKey, signature ?? '', 'base64url')
        expect(verified).toBe(true)
        expect(JSON.parse(Buffer.from(header ?? '', 'base64url').toString())).toEqual({
            alg: 'RS256',
            typ: 'JWT',
        })
        const iat = NOW.getTime() / 1000
        expect(JSON.parse(Buffer.from(payload ?? '', 'base64url').toString())).toEqual({
            iss: CLIENT_EMAIL,
            scope: 'https://www.googleapis.com/auth/analytics.readonly',
            aud: TOKEN_URI,
            iat,
            exp: iat + 3600,
        })
    })

    it('asks the reports with the bearer token, the right dates and the filter', async () => {
        const calls = stubFetch()
        await exec()
        for (const call of callsTo(calls, REPORT_URL)) {
            expect(call.init.method).toBe('POST')
            expect(call.init.headers).toMatchObject({
                authorization: `Bearer ${ACCESS_TOKEN}`,
            })
            expect(call.init.signal).toBeInstanceOf(AbortSignal)
        }
        const bodies = reportBodies(calls)
        const asked = (day: string) =>
            bodies
                .filter(body => body.dateRanges[0]?.startDate === day && body.dateRanges[0]?.endDate === day)
                .map(body => body.dimensions?.[0]?.name ?? 'totals')
                .sort()
        expect(asked(FULL_DAY)).toEqual([
            'dateHourMinute',
            'pagePath',
            'sessionSource',
            'totals',
        ])
        expect(asked(PRELIMINARY_DAY)).toEqual([
            'sessionSource',
            'totals',
        ])
        const markedBody = bodies.find(body => body.dimensions?.[0]?.name === 'dateHourMinute')
        expect(markedBody?.dimensionFilter).toEqual({
            notExpression: {
                filter: {
                    fieldName: 'sessionCampaignName',
                    inListFilter: {
                        values: [
                            '(direct)',
                            '(organic)',
                            '(referral)',
                            '(not set)',
                            '(data not available)',
                        ],
                    },
                },
            },
        })
    })

    it('sends the message to the chat and topic, in HTML, with escaped values', async () => {
        const calls = stubFetch()
        await exec()
        const [call] = callsTo(calls, TELEGRAM_URL)
        expect(call?.init.method).toBe('POST')
        expect(call?.init.signal).toBeInstanceOf(AbortSignal)
        expect(telegramBody(calls)).toEqual({
            chat_id: '-1001234567890',
            message_thread_id: 5,
            parse_mode: 'HTML',
            link_preview_options: {
                is_disabled: true,
            },
            text: `📊 <b>Дайджест за 4 ноября</b>
👥 9 человек · 12 визитов · в среднем 1:34
📄 31 просмотр

🔗 <b>Откуда</b>
linkedin / post-nextjs: 5 визитов, 2:10
прямые заходы: 4 визита, 0:40

🎯 <b>По меткам</b>
14:32 cover-letter / google · Berlin, компьютер · 3:20

📄 <b>Страницы</b>
/ 12
/&lt;b&gt;&amp;x=1 2

🕐 <b>5 ноября, предварительно:</b> 3 человека, linkedin / profile 2`,
        })
        // Telegram comes last: a failed report sends nothing.
        expect(calls.at(-1)?.url).toBe(TELEGRAM_URL)
    })

    it('uses DIGEST_DATE for the full day and the next day for the preliminary one', async () => {
        const calls = stubFetch()
        await expect(
            exec({
                DIGEST_DATE: '2026-10-31',
            }),
        ).resolves.toBe(0)
        const days = new Set(reportBodies(calls).map(body => body.dateRanges[0]?.startDate))
        expect([
            ...days,
        ]).toEqual(
            expect.arrayContaining([
                '2026-10-31',
                '2026-11-01',
            ]),
        )
        expect(days.size).toBe(2)
        const { text } = telegramBody(calls)
        expect(text).toContain('Дайджест за 31 октября')
        expect(text).toContain('1 ноября, предварительно')
    })

    it('reports a day without rows as nobody came, not as a failure', async () => {
        const calls = stubFetch({
            report: () =>
                json({
                    metricHeaders: names('activeUsers'),
                    kind: 'analyticsData#runReport',
                }),
        })
        await expect(exec()).resolves.toBe(0)
        expect(telegramBody(calls).text).toBe(
            `📊 <b>Дайджест за 4 ноября</b>
Никто не заходил.

🕐 <b>5 ноября, предварительно:</b> Никто не заходил.`,
        )
    })

    it('warns and adds a line when Google hid rows', async () => {
        const calls = stubFetch({
            report: body =>
                json({
                    ...(reportFor(body) as object),
                    metadata: {
                        subjectToThresholding: body.dimensions?.[0]?.name === 'pagePath',
                    },
                }),
        })
        await expect(exec()).resolves.toBe(0)
        expect(telegramBody(calls).text).toContain('Google скрыл часть строк')
        expect(logLines()[0]).toMatchObject({
            level: 'warn',
            msg: 'Google hid part of the rows',
            reports: [
                'pages',
            ],
        })
    })

    it('honours LOG_LEVEL', async () => {
        stubFetch()
        await exec({
            LOG_LEVEL: 'warn',
        })
        expect(output).toBe('')
    })
})

describe('a failed run', () => {
    it('stops at a missing variable before any request, naming it', async () => {
        const calls = stubFetch()
        await expect(
            exec({
                TELEGRAM_CHAT_ID: '',
            }),
        ).resolves.toBe(1)
        expect(calls).toHaveLength(0)
        expect(logLines()[0]).toMatchObject({
            level: 'error',
            service: 'digests',
            msg: 'Digest failed',
            error: expect.stringContaining('TELEGRAM_CHAT_ID'),
        })
        expectNoSecretInOutput()
    })

    it('fails on a Google 403 with the status and the message, and sends nothing', async () => {
        const calls = stubFetch({
            report: () =>
                json(
                    {
                        error: {
                            code: 403,
                            message: 'User does not have sufficient permissions for this property.',
                            status: 'PERMISSION_DENIED',
                        },
                    },
                    403,
                ),
        })
        await expect(exec()).resolves.toBe(1)
        expect(callsTo(calls, TELEGRAM_URL)).toHaveLength(0)
        const error = logLines().at(-1)?.error
        expect(error).toContain('403')
        expect(error).toContain('User does not have sufficient permissions')
        expectNoSecretInOutput()
    })

    it('fails when the token request is refused', async () => {
        const calls = stubFetch({
            token: () =>
                json(
                    {
                        error: 'invalid_grant',
                        error_description: 'Invalid JWT Signature.',
                    },
                    400,
                ),
        })
        await expect(exec()).resolves.toBe(1)
        expect(calls).toHaveLength(1)
        const error = logLines().at(-1)?.error
        expect(error).toContain('400')
        expect(error).toContain('Invalid JWT Signature.')
        expectNoSecretInOutput()
    })

    it('fails when the token response has no token', async () => {
        stubFetch({
            token: () => json({}),
        })
        await expect(exec()).resolves.toBe(1)
        expect(logLines().at(-1)?.error).toContain('no access_token')
    })

    it('fails on a 200 that is not a report, it is not an empty day', async () => {
        const calls = stubFetch({
            report: () => new Response('<html>oops</html>'),
        })
        await expect(exec()).resolves.toBe(1)
        expect(callsTo(calls, TELEGRAM_URL)).toHaveLength(0)
        expect(logLines().at(-1)?.error).toContain('Unexpected report response')
    })

    it('fails on a Telegram 400 with no token in the error', async () => {
        stubFetch({
            telegram: () =>
                json(
                    {
                        ok: false,
                        error_code: 400,
                        description: 'Bad Request: message thread not found',
                    },
                    400,
                ),
        })
        await expect(exec()).resolves.toBe(1)
        const error = logLines().at(-1)?.error
        expect(error).toContain('400')
        expect(error).toContain('message thread not found')
        expectNoSecretInOutput()
    })

    it('hides the token even if Telegram echoes it', async () => {
        stubFetch({
            telegram: () =>
                json(
                    {
                        ok: false,
                        description: `Not Found: ${TELEGRAM_URL}`,
                    },
                    404,
                ),
        })
        await expect(exec()).resolves.toBe(1)
        expect(output).not.toContain(BOT_TOKEN)
    })

    it('fails on a 200 from Telegram with ok: false', async () => {
        stubFetch({
            telegram: () =>
                json({
                    ok: false,
                    description: 'Forbidden',
                }),
        })
        await expect(exec()).resolves.toBe(1)
        expect(logLines().at(-1)?.error).toContain('Forbidden')
    })

    it('reports a network failure by kind, without the URL it carried', async () => {
        vi.stubGlobal('fetch', async (url: string) => {
            if (url === TOKEN_URI) {
                return json({
                    access_token: ACCESS_TOKEN,
                })
            }
            if (url === REPORT_URL) {
                return json({})
            }
            throw new TypeError(`fetch failed for ${url}`, {
                cause: Object.assign(new Error(`connect failed to ${url}`), {
                    code: 'ECONNRESET',
                }),
            })
        })
        await expect(exec()).resolves.toBe(1)
        expect(logLines().at(-1)?.error).toBe('Telegram request failed: ECONNRESET')
        expectNoSecretInOutput()
    })

    it('reports a timeout by kind', async () => {
        vi.stubGlobal('fetch', async () => {
            throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
        })
        await expect(exec()).resolves.toBe(1)
        expect(logLines().at(-1)?.error).toBe('Google token request failed: TimeoutError')
    })
})
