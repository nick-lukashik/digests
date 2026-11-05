import { describe, expect, it } from 'vitest'
import { addDays, digestDays, localDay } from './dates.js'

describe('localDay', () => {
    // Tbilisi is UTC+4 all year.
    it('is still the same day just before midnight in Tbilisi', () => {
        expect(localDay(new Date('2026-11-05T19:59:59Z'))).toBe('2026-11-05')
    })

    it('turns at 20:00 UTC, which is midnight in Tbilisi', () => {
        expect(localDay(new Date('2026-11-05T20:00:00Z'))).toBe('2026-11-06')
    })

    it('does not turn at midnight UTC', () => {
        expect(localDay(new Date('2026-11-04T23:59:59Z'))).toBe('2026-11-05')
        expect(localDay(new Date('2026-11-05T00:00:00Z'))).toBe('2026-11-05')
    })
})

describe('addDays', () => {
    it.each([
        [
            '2026-01-31',
            1,
            '2026-02-01',
        ],
        [
            '2026-03-01',
            -1,
            '2026-02-28',
        ],
        [
            '2028-03-01',
            -1,
            '2028-02-29',
        ],
        [
            '2026-12-31',
            1,
            '2027-01-01',
        ],
        [
            '2027-01-01',
            -2,
            '2026-12-30',
        ],
    ])('%s %i is %s', (day, days, expected) => {
        expect(addDays(day, days)).toBe(expected)
    })
})

describe('digestDays', () => {
    it('takes today minus 2 for the full report and minus 1 for the preliminary line', () => {
        expect(digestDays(new Date('2026-11-06T08:00:00Z'))).toEqual({
            full: '2026-11-04',
            preliminary: '2026-11-05',
        })
    })

    it('counts from the Tbilisi day when UTC is still on the previous one', () => {
        expect(digestDays(new Date('2026-11-05T21:00:00Z'))).toEqual({
            full: '2026-11-04',
            preliminary: '2026-11-05',
        })
    })

    it('crosses a month end', () => {
        expect(digestDays(new Date('2026-12-01T08:00:00Z'))).toEqual({
            full: '2026-11-29',
            preliminary: '2026-11-30',
        })
        expect(digestDays(new Date('2026-12-02T08:00:00Z'))).toEqual({
            full: '2026-11-30',
            preliminary: '2026-12-01',
        })
    })

    it('counts from the new month in Tbilisi while UTC is still in the old one', () => {
        expect(digestDays(new Date('2026-11-30T23:30:00Z'))).toEqual({
            full: '2026-11-29',
            preliminary: '2026-11-30',
        })
    })

    it('crosses February in a leap year', () => {
        expect(digestDays(new Date('2028-03-01T08:00:00Z'))).toEqual({
            full: '2028-02-28',
            preliminary: '2028-02-29',
        })
    })

    it('crosses a year when Tbilisi is already in the new one', () => {
        expect(digestDays(new Date('2026-12-31T20:30:00Z'))).toEqual({
            full: '2026-12-30',
            preliminary: '2026-12-31',
        })
    })

    it.each([
        [
            'today',
            '2026-11-06',
        ],
        [
            'yesterday',
            '2026-11-05',
        ],
        [
            'a day to come',
            '2026-11-07',
        ],
    ])('has no preliminary day when the next day has not ended: an override of %s', (_case, override) => {
        expect(digestDays(new Date('2026-11-06T08:00:00Z'), override)).toEqual({
            full: override,
        })
    })

    it('uses an override as the full day and the next day as preliminary', () => {
        expect(digestDays(new Date('2026-11-06T08:00:00Z'), '2026-10-31')).toEqual({
            full: '2026-10-31',
            preliminary: '2026-11-01',
        })
    })
})
