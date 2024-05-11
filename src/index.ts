import { initContext } from './config'
import { startIndexer, stopIndexer } from './indexer/indexer'
import { startServerJob, stopServerJob } from './api/serverJob'
import { configDotenv } from 'dotenv'
import { join } from 'path'
import { openDB } from './db'

if (process.env.NODE_ENV !== 'production') {
	configDotenv({ path: join(__dirname, '../.env.dev') })
}

async function main() {
	await openDB()
	const context = await initContext()
	startIndexer(context)
	startServerJob(context)
}

process.on('SIGINT' || 'beforeExit', async () => {
	stopIndexer()
	stopServerJob()
})

main()
