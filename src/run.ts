import { digestDays } from './dates.js'
import { type Env, readEnv } from './env.js'
import { formatDigest } from './format.js'
import { fetchAccessToken, runReport } from './google.js'
import { createLogger, type Logger, type Write } from './logger.js'
import {
    markedVisitsRequest,
    pagesRequest,
    type ReportRequest,
    readMarkedVisits,
    readPages,
    readSources,
    readTotals,
    sourcesRequest,
    totalsRequest,
} from './reports.js'
import { sendMessage } from './telegram.js'

async function sendDigest(env: Env, now: Date, log: Logger): Promise<void> {
    const days = digestDays(now, env.DIGEST_DATE)
    const accessToken = await fetchAccessToken(env.GA_SERVICE_ACCOUNT_JSON, now)
    const report = (request: ReportRequest) => runReport(env.GA_PROPERTY_ID, accessToken, request)
    const { preliminary: preliminaryDay } = days
    const [totals, sources, markedVisits, pages, preliminaryTotals, preliminarySources] = await Promise.all([
        report(totalsRequest(days.full)),
        report(sourcesRequest(days.full)),
        report(markedVisitsRequest(days.full)),
        report(pagesRequest(days.full)),
        preliminaryDay ? report(totalsRequest(preliminaryDay)) : undefined,
        preliminaryDay ? report(sourcesRequest(preliminaryDay)) : undefined,
    ])

    const hidden = Object.entries({
        totals,
        sources,
        markedVisits,
        pages,
        preliminaryTotals,
        preliminarySources,
    })
        .filter(([, item]) => item?.thresholded)
        .map(([name]) => name)
    if (hidden.length > 0) {
        log.warn('Google hid part of the rows', {
            reports: hidden,
        })
    }

    await sendMessage(
        {
            botToken: env.TELEGRAM_BOT_TOKEN,
            chatId: env.TELEGRAM_CHAT_ID,
            topicId: env.TELEGRAM_TOPIC_ID,
        },
        formatDigest({
            date: days.full,
            totals: readTotals(totals),
            sources: readSources(sources),
            markedVisits: readMarkedVisits(markedVisits),
            pages: readPages(pages),
            ...(preliminaryDay
                && preliminaryTotals
                && preliminarySources && {
                    preliminary: {
                        date: preliminaryDay,
                        totals: readTotals(preliminaryTotals),
                        topSource: readSources(preliminarySources).rows[0],
                    },
                }),
            thresholded: hidden.length > 0,
        }),
    )
    log.info('Digest sent', {
        date: days.full,
        preliminaryDate: preliminaryDay,
    })
}

/** One run of the job: 0 when the digest went out, 1 on any failure, so the Job retries. */
export async function run(source: NodeJS.ProcessEnv, now: Date, write: Write): Promise<number> {
    let log = createLogger('info', write)
    try {
        const env = readEnv(source)
        log = createLogger(env.LOG_LEVEL, write)
        await sendDigest(env, now, log)
        return 0
    } catch (error) {
        log.error('Digest failed', {
            error: error instanceof Error ? error.message : 'unknown error',
        })
        return 1
    }
}
