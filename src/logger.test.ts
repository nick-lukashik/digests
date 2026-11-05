import { describe, expect, it, vi } from 'vitest'
import { createLogger } from './logger.js'

describe('createLogger', () => {
    it('writes one JSON line with level, time, service and msg', () => {
        const write = vi.fn<(line: string) => void>()
        createLogger('info', write).warn('Something', {
            date: '2026-11-04',
        })
        expect(write).toHaveBeenCalledTimes(1)
        const [line] = write.mock.calls[0] ?? []
        expect(line?.endsWith('\n')).toBe(true)
        expect(JSON.parse(line ?? '')).toEqual({
            level: 'warn',
            time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
            service: 'digests',
            msg: 'Something',
            date: '2026-11-04',
        })
    })

    it('skips lines below the level', () => {
        const write = vi.fn<(line: string) => void>()
        const log = createLogger('warn', write)
        log.info('quiet')
        log.warn('heard')
        log.error('heard')
        expect(write).toHaveBeenCalledTimes(2)
    })

    it('writes nothing when silent', () => {
        const write = vi.fn<(line: string) => void>()
        createLogger('silent', write).error('quiet')
        expect(write).not.toHaveBeenCalled()
    })
})
