import { isRecord, post } from './http.js'

export type TelegramTarget = {
    botToken: string
    chatId: string
    topicId: number
}

export async function sendMessage(target: TelegramTarget, text: string): Promise<void> {
    const response = await post('Telegram request', `https://api.telegram.org/bot${target.botToken}/sendMessage`, {
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: target.chatId,
            message_thread_id: target.topicId,
            parse_mode: 'HTML',
            link_preview_options: {
                is_disabled: true,
            },
            text,
        }),
    })
    const { body } = response
    if (response.ok && isRecord(body) && body.ok === true) return
    const description = isRecord(body) && typeof body.description === 'string' ? body.description : 'no description'
    throw new Error(`Telegram request failed: ${response.status} ${description.replaceAll(target.botToken, '<token>')}`)
}
