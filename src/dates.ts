/** Every date of this program is a calendar day in this zone. */
export const TIME_ZONE = 'Asia/Tbilisi'

export type DigestDays = {
    full: string
    /** Only a day that has ended: a run by hand for yesterday or today has none. */
    preliminary?: string
}

/** The calendar day (YYYY-MM-DD) of an instant in TIME_ZONE. */
export function localDay(now: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now)
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value
    return `${part('year')}-${part('month')}-${part('day')}`
}

export function addDays(day: string, days: number): string {
    const date = new Date(`${day}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

/**
 * Google has a day's data ready only in the afternoon of the next day, so at
 * 12:00 the day before yesterday is complete and yesterday is preliminary.
 * `override` (DIGEST_DATE, a run by hand) names the full day instead.
 */
export function digestDays(now: Date, override?: string): DigestDays {
    const today = localDay(now)
    const full = override ?? addDays(today, -2)
    const next = addDays(full, 1)
    return {
        full,
        ...(next < today && {
            preliminary: next,
        }),
    }
}
