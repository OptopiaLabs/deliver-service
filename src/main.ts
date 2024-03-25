import { openDB, closeDB } from './db'
import { initContext, stopAll } from './config'
import { startIndexer } from './indexer/indexer'
import { startServer, stopServer } from './api/server'

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
