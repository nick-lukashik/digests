/** From quiet to loud; the same names as pino in the other services. */
export const LOG_LEVELS = [
    'silent',
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

type Fields = Record<string, unknown>

export type Logger = {
    info: (msg: string, fields?: Fields) => void
    warn: (msg: string, fields?: Fields) => void
    error: (msg: string, fields?: Fields) => void
}

export type Write = (line: string) => void

/** JSON lines. Tokens, the key and the message's contents never go in `fields`. */
export function createLogger(level: LogLevel, write: Write): Logger {
    const line =
        (lineLevel: LogLevel) =>
        (msg: string, fields: Fields = {}) => {
            if (LOG_LEVELS.indexOf(lineLevel) > LOG_LEVELS.indexOf(level)) return
            write(
                `${JSON.stringify({
                    level: lineLevel,
                    time: new Date().toISOString(),
                    service: 'digests',
                    msg,
                    ...fields,
                })}\n`,
            )
        }
    return {
        info: line('info'),
        warn: line('warn'),
        error: line('error'),
    }
}
