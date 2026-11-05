import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { readEnv } from './env.js'

const { privateKey } = generateKeyPairSync('rsa', {
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

const account = {
    type: 'service_account',
    client_email: 'digests@example.iam.gserviceaccount.com',
    private_key: privateKey,
    token_uri: 'https://oauth2.googleapis.com/token',
}

const valid = {
    GA_PROPERTY_ID: '123456789',
    GA_SERVICE_ACCOUNT_JSON: JSON.stringify(account),
    TELEGRAM_BOT_TOKEN: 'bot-token-value',
    TELEGRAM_CHAT_ID: '-1001234567890',
    TELEGRAM_TOPIC_ID: '5',
}

function failure(source: NodeJS.ProcessEnv): string {
    try {
        readEnv(source)
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
    throw new Error('expected readEnv to throw')
}

describe('readEnv', () => {
    it('reads a valid environment', () => {
        const env = readEnv(valid)
        expect(env.GA_PROPERTY_ID).toBe('123456789')
        expect(env.GA_SERVICE_ACCOUNT_JSON.client_email).toBe(account.client_email)
        expect(env.TELEGRAM_CHAT_ID).toBe('-1001234567890')
        expect(env.TELEGRAM_TOPIC_ID).toBe(5)
        expect(env.DIGEST_DATE).toBeUndefined()
        expect(env.LOG_LEVEL).toBe('info')
    })

    it.each([
        'GA_PROPERTY_ID',
        'GA_SERVICE_ACCOUNT_JSON',
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHAT_ID',
        'TELEGRAM_TOPIC_ID',
    ])('names a missing %s', name => {
        const { [name as keyof typeof valid]: _, ...rest } = valid
        expect(failure(rest)).toMatch(new RegExp(`${name}: required`))
    })

    it('names every missing variable and prints no value', () => {
        const message = failure({
            TELEGRAM_BOT_TOKEN: 'bot-token-value',
        })
        for (const name of [
            'GA_PROPERTY_ID',
            'GA_SERVICE_ACCOUNT_JSON',
            'TELEGRAM_CHAT_ID',
            'TELEGRAM_TOPIC_ID',
        ]) {
            expect(message).toContain(name)
        }
        expect(message).not.toContain('bot-token-value')
    })

    it('treats a blank value as missing', () => {
        expect(
            failure({
                ...valid,
                TELEGRAM_BOT_TOKEN: '',
            }),
        ).toMatch(/TELEGRAM_BOT_TOKEN: required/)
        expect(
            readEnv({
                ...valid,
                DIGEST_DATE: '',
                LOG_LEVEL: '',
            }),
        ).toMatchObject({
            LOG_LEVEL: 'info',
        })
    })

    it.each([
        [
            'GA_PROPERTY_ID',
            'properties/12',
        ],
        [
            'TELEGRAM_CHAT_ID',
            '1001234567890',
        ],
        [
            'TELEGRAM_CHAT_ID',
            '-12a',
        ],
        [
            'TELEGRAM_TOPIC_ID',
            '5.5',
        ],
        [
            'DIGEST_DATE',
            '04.11.2026',
        ],
        [
            'DIGEST_DATE',
            '2026-02-30',
        ],
        [
            'LOG_LEVEL',
            'loud',
        ],
    ])('rejects %s=%s without printing it', (name, value) => {
        const message = failure({
            ...valid,
            [name]: value,
        })
        expect(message).toContain(name)
        expect(message).not.toContain(value)
    })

    it('accepts a DIGEST_DATE and a LOG_LEVEL', () => {
        expect(
            readEnv({
                ...valid,
                DIGEST_DATE: '2026-11-04',
                LOG_LEVEL: 'debug',
            }),
        ).toMatchObject({
            DIGEST_DATE: '2026-11-04',
            LOG_LEVEL: 'debug',
        })
    })

    it('does not quote a service account that is not JSON', () => {
        const message = failure({
            ...valid,
            GA_SERVICE_ACCOUNT_JSON: 'sensitive-key-material{',
        })
        expect(message).toContain('GA_SERVICE_ACCOUNT_JSON: not valid JSON')
        expect(message).not.toContain('sensitive-key-material')
    })

    it.each([
        'client_email',
        'private_key',
        'token_uri',
    ] as const)('names a missing %s of the service account', field => {
        const { [field]: _, ...rest } = account
        expect(
            failure({
                ...valid,
                GA_SERVICE_ACCOUNT_JSON: JSON.stringify(rest),
            }),
        ).toContain(`GA_SERVICE_ACCOUNT_JSON.${field}`)
    })

    it('rejects a private key that does not parse, without printing it', () => {
        const message = failure({
            ...valid,
            GA_SERVICE_ACCOUNT_JSON: JSON.stringify({
                ...account,
                private_key: 'sensitive-key-material',
            }),
        })
        expect(message).toContain('GA_SERVICE_ACCOUNT_JSON.private_key')
        expect(message).not.toContain('sensitive-key-material')
    })

    it('rejects a token_uri that is not https', () => {
        expect(
            failure({
                ...valid,
                GA_SERVICE_ACCOUNT_JSON: JSON.stringify({
                    ...account,
                    token_uri: 'http://oauth2.googleapis.com/token',
                }),
            }),
        ).toContain('GA_SERVICE_ACCOUNT_JSON.token_uri')
    })
})
