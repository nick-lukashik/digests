const REQUEST_TIMEOUT_MS = 30_000

export type JsonResponse = {
    ok: boolean
    status: number
    /** The parsed body; undefined when it is not JSON. */
    body: unknown
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

function failureKind(error: unknown): string {
    if (!(error instanceof Error)) return 'unknown error'
    const { cause } = error
    if (cause instanceof Error && 'code' in cause && typeof cause.code === 'string') return cause.code
    return error.name
}

/**
 * POST within the time budget. A network failure or a timeout reports only its
 * kind: fetch errors can quote the URL, and the Telegram URL holds the bot token.
 */
export async function post(
    what: string,
    url: string,
    request: {
        headers: Record<string, string>
        body: string
    },
): Promise<JsonResponse> {
    try {
        const response = await fetch(url, {
            ...request,
            method: 'POST',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        const text = await response.text()
        return {
            ok: response.ok,
            status: response.status,
            body: parseJson(text),
        }
    } catch (error) {
        throw new Error(`${what} failed: ${failureKind(error)}`)
    }
}
