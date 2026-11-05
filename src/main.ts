import { run } from './run.js'

process.exitCode = await run(process.env, new Date(), line => process.stdout.write(line))
