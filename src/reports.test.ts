import { describe, expect, it } from 'vitest'
import {
    markedVisitsRequest,
    pagesRequest,
    parseReport,
    readMarkedVisits,
    readPages,
    readSources,
    readTotals,
    sourcesRequest,
    totalsRequest,
} from './reports.js'

const DAY = '2026-11-04'
const dateRanges = [
    {
        startDate: DAY,
        endDate: DAY,
    },
]

function names(...values: string[]) {
    return values.map(name => ({
        name,
    }))
}

describe('requests', () => {
    it('asks totals for the four metrics, with no dimensions', () => {
        expect(totalsRequest(DAY)).toEqual({
            dateRanges,
            metrics: names('activeUsers', 'sessions', 'averageSessionDuration', 'screenPageViews'),
        })
    })

    it('asks sources ordered by sessions, limit 30', () => {
        expect(sourcesRequest(DAY)).toEqual({
            dateRanges,
            dimensions: names('sessionSource', 'sessionMedium', 'sessionCampaignName'),
            metrics: names('sessions', 'averageSessionDuration'),
            orderBys: [
                {
                    metric: {
                        metricName: 'sessions',
                    },
                    desc: true,
                },
            ],
            limit: 30,
        })
    })

    it('asks marked visits without unmarked campaigns, ordered by time, limit 30', () => {
        expect(markedVisitsRequest(DAY)).toEqual({
            dateRanges,
            dimensions: names(
                'dateHourMinute',
                'sessionSource',
                'sessionCampaignName',
                'city',
                'country',
                'deviceCategory',
            ),
            metrics: names('sessions', 'averageSessionDuration'),
            dimensionFilter: {
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
            },
            orderBys: [
                {
                    dimension: {
                        dimensionName: 'dateHourMinute',
                    },
                },
            ],
            limit: 30,
        })
    })

    it('asks pages ordered by views, limit 8', () => {
        expect(pagesRequest(DAY)).toEqual({
            dateRanges,
            dimensions: names('pagePath'),
            metrics: names('screenPageViews'),
            orderBys: [
                {
                    metric: {
                        metricName: 'screenPageViews',
                    },
                    desc: true,
                },
            ],
            limit: 8,
        })
    })
})

function row(dimensions: string[], metrics: string[]) {
    return {
        dimensionValues: dimensions.map(value => ({
            value,
        })),
        metricValues: metrics.map(value => ({
            value,
        })),
    }
}

describe('parseReport', () => {
    it('reads no rows as a day without data', () => {
        const report = parseReport({
            metricHeaders: names('activeUsers', 'sessions', 'averageSessionDuration', 'screenPageViews'),
            kind: 'analyticsData#runReport',
        })
        expect(report).toEqual({
            rows: [],
            rowCount: 0,
            thresholded: false,
        })
        expect(readTotals(report)).toEqual({
            users: 0,
            sessions: 0,
            averageDuration: 0,
            views: 0,
        })
        expect(readSources(report)).toEqual({
            rows: [],
            total: 0,
        })
    })

    it('reads subjectToThresholding', () => {
        expect(
            parseReport({
                metadata: {
                    subjectToThresholding: true,
                },
            }).thresholded,
        ).toBe(true)
        expect(
            parseReport({
                metadata: {
                    subjectToThresholding: false,
                },
            }).thresholded,
        ).toBe(false)
    })

    it('reads totals by header name, not by position', () => {
        const report = parseReport({
            metricHeaders: names('screenPageViews', 'averageSessionDuration', 'sessions', 'activeUsers'),
            rows: [
                row(
                    [],
                    [
                        '31',
                        '94.4',
                        '12',
                        '9',
                    ],
                ),
            ],
            rowCount: 1,
        })
        expect(readTotals(report)).toEqual({
            users: 9,
            sessions: 12,
            averageDuration: 94.4,
            views: 31,
        })
    })

    it('reads sources and keeps the full count', () => {
        const report = parseReport({
            dimensionHeaders: names('sessionSource', 'sessionMedium', 'sessionCampaignName'),
            metricHeaders: names('sessions', 'averageSessionDuration'),
            rows: [
                row(
                    [
                        'linkedin',
                        'social',
                        'post-nextjs',
                    ],
                    [
                        '5',
                        '130',
                    ],
                ),
            ],
            rowCount: 44,
        })
        expect(readSources(report)).toEqual({
            total: 44,
            rows: [
                {
                    source: 'linkedin',
                    medium: 'social',
                    campaign: 'post-nextjs',
                    sessions: 5,
                    averageDuration: 130,
                },
            ],
        })
    })

    it('reads marked visits and pages', () => {
        const visits = parseReport({
            dimensionHeaders: names(
                'dateHourMinute',
                'sessionSource',
                'sessionCampaignName',
                'city',
                'country',
                'deviceCategory',
            ),
            metricHeaders: names('sessions', 'averageSessionDuration'),
            rows: [
                row(
                    [
                        '202611041432',
                        'google',
                        'cover-letter',
                        'Berlin',
                        'Germany',
                        'desktop',
                    ],
                    [
                        '1',
                        '200',
                    ],
                ),
            ],
        })
        expect(readMarkedVisits(visits).rows).toEqual([
            {
                dateHourMinute: '202611041432',
                source: 'google',
                campaign: 'cover-letter',
                city: 'Berlin',
                country: 'Germany',
                device: 'desktop',
                averageDuration: 200,
            },
        ])
        const pages = parseReport({
            dimensionHeaders: names('pagePath'),
            metricHeaders: names('screenPageViews'),
            rows: [
                row(
                    [
                        '/privacy',
                    ],
                    [
                        '2',
                    ],
                ),
            ],
        })
        expect(readPages(pages)).toEqual({
            total: 1,
            rows: [
                {
                    path: '/privacy',
                    views: 2,
                },
            ],
        })
    })

    it.each([
        [
            'no body',
            undefined,
        ],
        [
            'an array',
            [],
        ],
        [
            'rows that are not a list',
            {
                rows: 'none',
            },
        ],
        [
            'rows without headers',
            {
                rows: [
                    row(
                        [],
                        [
                            '1',
                        ],
                    ),
                ],
            },
        ],
        [
            'a row shorter than the headers',
            {
                metricHeaders: names('sessions', 'activeUsers'),
                rows: [
                    row(
                        [],
                        [
                            '1',
                        ],
                    ),
                ],
            },
        ],
        [
            'a metric that is not a number',
            {
                metricHeaders: names('sessions'),
                rows: [
                    row(
                        [],
                        [
                            'many',
                        ],
                    ),
                ],
            },
        ],
    ])('throws on %s, it is not an empty day', (_, body) => {
        expect(() => parseReport(body)).toThrow(/Unexpected report response/)
    })

    it('throws when a requested column is missing', () => {
        const report = parseReport({
            metricHeaders: names('sessions'),
            rows: [
                row(
                    [],
                    [
                        '1',
                    ],
                ),
            ],
        })
        expect(() => readTotals(report)).toThrow(/Unexpected report response/)
    })
})
