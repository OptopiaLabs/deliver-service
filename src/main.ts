import { openDB, closeDB } from './db'
import { initContext, stopAll } from './config'
import { startIndexer } from './indexer/indexer'
import { startServer, stopServer } from './api/server'
import { configDotenv } from 'dotenv'
import { join } from 'path'

if (process.env.NODE_ENV !== 'production') {
	configDotenv({ path: join(__dirname, '../.env.dev') })
}

async function main() {
	await openDB()
	await initContext()
	startIndexer()
	startServer()
}

process.on('SIGINT', async () => {
	stopAll()
	stopServer()
	await closeDB()
})

main()
