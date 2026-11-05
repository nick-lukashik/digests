import { createPrivateKey } from 'node:crypto'
import { z } from 'zod'
import { LOG_LEVELS } from './logger.js'

const required = () =>
    z
        .string({
            error: 'required',
        })
        .min(1, {
            error: 'required',
        })

function isRsaPrivateKey(pem: string): boolean {
    try {
        return createPrivateKey(pem).asymmetricKeyType === 'rsa'
    } catch {
        return false
    }
}

const serviceAccountSchema = z.object(
    {
        client_email: required(),
        private_key: required().refine(isRsaPrivateKey, {
            error: 'not an RSA private key in PEM',
        }),
        token_uri: z.url({
            protocol: /^https$/,
            error: 'not an https URL',
        }),
    },
    {
        error: 'not a JSON object',
    },
)

const envSchema = z.object({
    GA_PROPERTY_ID: required().regex(/^\d+$/, {
        error: 'digits only',
    }),
    GA_SERVICE_ACCOUNT_JSON: required()
        .transform((text, ctx) => {
            try {
                return JSON.parse(text) as unknown
            } catch {
                // JSON.parse quotes the text in its error, so that error stays here.
                ctx.issues.push({
                    code: 'custom',
                    message: 'not valid JSON',
                    input: text,
                })
                return z.NEVER
            }
        })
        .pipe(serviceAccountSchema),
    TELEGRAM_BOT_TOKEN: required(),
    TELEGRAM_CHAT_ID: required().regex(/^-\d+$/, {
        error: 'not a negative integer',
    }),
    TELEGRAM_TOPIC_ID: required()
        .regex(/^-?\d+$/, {
            error: 'not an integer',
        })
        .transform(Number),
    DIGEST_DATE: z.iso
        .date({
            error: 'not a YYYY-MM-DD date',
        })
        .optional(),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
})

export type Env = z.output<typeof envSchema>
export type ServiceAccount = Env['GA_SERVICE_ACCOUNT_JSON']

/** Names every invalid variable with the reason, never a value. A blank value counts as missing. */
export function readEnv(source: NodeJS.ProcessEnv): Env {
    const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''))
    const result = envSchema.safeParse(present)
    if (!result.success) {
        const lines = result.error.issues.map(issue => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        throw new Error(`Invalid environment:\n${lines.join('\n')}`)
    }
    return result.data
}
