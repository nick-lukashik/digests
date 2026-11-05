import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        restoreMocks: true,
        unstubGlobals: true,
        include: [
            'src/**/*.test.ts',
        ],
    },
})
