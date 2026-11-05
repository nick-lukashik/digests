import { createSign } from 'node:crypto'
import type { ServiceAccount } from './env.js'
import { isRecord, post } from './http.js'
import { parseReport, type Report, type ReportRequest } from './reports.js'

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const TOKEN_LIFETIME_S = 3600

function base64url(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** The RS256 JWT a service account trades for an access token. */
export function signAssertion(account: ServiceAccount, now: Date): string {
    const iat = Math.floor(now.getTime() / 1000)
    const unsigned = [
        base64url({
            alg: 'RS256',
            typ: 'JWT',
        }),
        base64url({
            iss: account.client_email,
            scope: SCOPE,
            aud: account.token_uri,
            iat,
            exp: iat + TOKEN_LIFETIME_S,
        }),
    ].join('.')
    const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url')
    return `${unsigned}.${signature}`
}

/** Reports have { error: { message } }, the token endpoint { error, error_description }. */
function errorMessage(body: unknown): string {
    if (isRecord(body)) {
        if (isRecord(body.error) && typeof body.error.message === 'string') return body.error.message
        if (typeof body.error_description === 'string') return body.error_description
        if (typeof body.error === 'string') return body.error
    }
    return 'no error message'
}

export async function fetchAccessToken(account: ServiceAccount, now: Date): Promise<string> {
    const response = await post('Google token request', account.token_uri, {
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: GRANT_TYPE,
            assertion: signAssertion(account, now),
        }).toString(),
    })
    if (!response.ok) {
        throw new Error(`Google token request failed: ${response.status} ${errorMessage(response.body)}`)
    }
    if (!isRecord(response.body) || typeof response.body.access_token !== 'string') {
        throw new Error('Google token request failed: no access_token in the response')
    }
    return response.body.access_token
}

export async function runReport(propertyId: string, accessToken: string, request: ReportRequest): Promise<Report> {
    const response = await post('Google report request', `${DATA_API}/properties/${propertyId}:runReport`, {
        headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify(request),
    })
    if (!response.ok) {
        throw new Error(`Google report request failed: ${response.status} ${errorMessage(response.body)}`)
    }
    return parseReport(response.body)
}
