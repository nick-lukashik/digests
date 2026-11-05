import { isRecord } from './http.js'

/** The body of a runReport request. */
export type ReportRequest = Record<string, unknown>

/** sessionCampaignName of a visit that did not come from a marked link. */
const UNMARKED_CAMPAIGNS = [
    '(direct)',
    '(organic)',
    '(referral)',
    '(not set)',
    '(data not available)',
]

function query(date: string, metrics: string[], dimensions: string[] = []): ReportRequest {
    return {
        dateRanges: [
            {
                startDate: date,
                endDate: date,
            },
        ],
        ...(dimensions.length > 0 && {
            dimensions: dimensions.map(name => ({
                name,
            })),
        }),
        metrics: metrics.map(name => ({
            name,
        })),
    }
}

function byMetric(metricName: string) {
    return [
        {
            metric: {
                metricName,
            },
            desc: true,
        },
    ]
}

export function totalsRequest(date: string): ReportRequest {
    return query(date, [
        'activeUsers',
        'sessions',
        'averageSessionDuration',
        'screenPageViews',
    ])
}

export function sourcesRequest(date: string): ReportRequest {
    return {
        ...query(
            date,
            [
                'sessions',
                'averageSessionDuration',
            ],
            [
                'sessionSource',
                'sessionMedium',
                'sessionCampaignName',
            ],
        ),
        orderBys: byMetric('sessions'),
        limit: 30,
    }
}

export function markedVisitsRequest(date: string): ReportRequest {
    return {
        ...query(
            date,
            [
                'sessions',
                'averageSessionDuration',
            ],
            [
                'dateHourMinute',
                'sessionSource',
                'sessionCampaignName',
                'city',
                'country',
                'deviceCategory',
            ],
        ),
        dimensionFilter: {
            notExpression: {
                filter: {
                    fieldName: 'sessionCampaignName',
                    inListFilter: {
                        values: UNMARKED_CAMPAIGNS,
                    },
                },
            },
        },
        orderBys: [
            {
                dimension: {
                    dimensionName: 'dateHourMinute',
                },
            },
        ],
        limit: 30,
    }
}

export function pagesRequest(date: string): ReportRequest {
    return {
        ...query(
            date,
            [
                'screenPageViews',
            ],
            [
                'pagePath',
            ],
        ),
        orderBys: byMetric('screenPageViews'),
        limit: 8,
    }
}

type ReportRow = {
    dimensions: Map<string, string>
    metrics: Map<string, number>
}

export type Report = {
    /** Empty means nobody came; a failed request throws and never gets here. */
    rows: ReportRow[]
    /** All matching rows, also those over the request's limit. */
    rowCount: number
    /** Google left out rows to protect visitors' privacy. */
    thresholded: boolean
}

const UNEXPECTED = 'Unexpected report response from Google'

function headerNames(headers: unknown): string[] {
    if (headers === undefined) return []
    if (!Array.isArray(headers)) throw new Error(UNEXPECTED)
    return headers.map(header => {
        if (!isRecord(header) || typeof header.name !== 'string') throw new Error(UNEXPECTED)
        return header.name
    })
}

function cellValues(cells: unknown, expected: number): string[] {
    if (expected === 0 && cells === undefined) return []
    if (!Array.isArray(cells) || cells.length !== expected) throw new Error(UNEXPECTED)
    return cells.map(cell => (isRecord(cell) && typeof cell.value === 'string' ? cell.value : ''))
}

function parseRow(row: unknown, dimensions: string[], metrics: string[]): ReportRow {
    if (!isRecord(row)) throw new Error(UNEXPECTED)
    const dimensionValues = cellValues(row.dimensionValues, dimensions.length)
    const metricValues = cellValues(row.metricValues, metrics.length)
    return {
        dimensions: new Map(
            dimensions.map((name, index) => [
                name,
                dimensionValues[index] ?? '',
            ]),
        ),
        metrics: new Map(
            metrics.map((name, index) => {
                const value = Number(metricValues[index])
                if (!Number.isFinite(value)) throw new Error(UNEXPECTED)
                return [
                    name,
                    value,
                ]
            }),
        ),
    }
}

/** A response with no `rows` is a day without data, anything malformed throws. */
export function parseReport(body: unknown): Report {
    if (!isRecord(body)) throw new Error(UNEXPECTED)
    const rawRows = body.rows ?? []
    if (!Array.isArray(rawRows)) throw new Error(UNEXPECTED)
    const dimensions = headerNames(body.dimensionHeaders)
    const metrics = headerNames(body.metricHeaders)
    const rows = rawRows.map(row => parseRow(row, dimensions, metrics))
    const rowCount = Number(body.rowCount ?? 0)
    return {
        rows,
        rowCount: Number.isFinite(rowCount) ? Math.max(rowCount, rows.length) : rows.length,
        thresholded: isRecord(body.metadata) && body.metadata.subjectToThresholding === true,
    }
}

function text(row: ReportRow, name: string): string {
    const value = row.dimensions.get(name)
    if (value === undefined) throw new Error(UNEXPECTED)
    return value
}

function number(row: ReportRow, name: string): number {
    const value = row.metrics.get(name)
    if (value === undefined) throw new Error(UNEXPECTED)
    return value
}

export type Totals = {
    users: number
    sessions: number
    averageDuration: number
    views: number
}

/** Rows of a list and how many exist in all. */
export type Listing<T> = {
    rows: T[]
    total: number
}

export type Source = {
    source: string
    medium: string
    campaign: string
    sessions: number
    averageDuration: number
}

export type MarkedVisit = {
    dateHourMinute: string
    source: string
    campaign: string
    city: string
    country: string
    device: string
    averageDuration: number
}

export type Page = {
    path: string
    views: number
}

export function readTotals(report: Report): Totals {
    const [row] = report.rows
    if (!row) {
        return {
            users: 0,
            sessions: 0,
            averageDuration: 0,
            views: 0,
        }
    }
    return {
        users: number(row, 'activeUsers'),
        sessions: number(row, 'sessions'),
        averageDuration: number(row, 'averageSessionDuration'),
        views: number(row, 'screenPageViews'),
    }
}

export function readSources(report: Report): Listing<Source> {
    return {
        total: report.rowCount,
        rows: report.rows.map(row => ({
            source: text(row, 'sessionSource'),
            medium: text(row, 'sessionMedium'),
            campaign: text(row, 'sessionCampaignName'),
            sessions: number(row, 'sessions'),
            averageDuration: number(row, 'averageSessionDuration'),
        })),
    }
}

export function readMarkedVisits(report: Report): Listing<MarkedVisit> {
    return {
        total: report.rowCount,
        rows: report.rows.map(row => ({
            dateHourMinute: text(row, 'dateHourMinute'),
            source: text(row, 'sessionSource'),
            campaign: text(row, 'sessionCampaignName'),
            city: text(row, 'city'),
            country: text(row, 'country'),
            device: text(row, 'deviceCategory'),
            averageDuration: number(row, 'averageSessionDuration'),
        })),
    }
}

export function readPages(report: Report): Listing<Page> {
    return {
        total: report.rowCount,
        rows: report.rows.map(row => ({
            path: text(row, 'pagePath'),
            views: number(row, 'screenPageViews'),
        })),
    }
}
