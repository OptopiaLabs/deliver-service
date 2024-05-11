import { parentPort, workerData } from 'node:worker_threads'
import { sleep } from '../utils'
import { openDB } from '../db'

interface Message {
	stop: boolean
	data?: any
}

export async function createSimpleRunner(runner: {
	start: (args?: any) => void,
	stop?: (args?: any) => void
}) {
	parentPort.on('message', (msg: Message) => {
		if (!msg.stop) {
			runner.start(workerData)
		} else {
			runner.stop(workerData)
		}
	})
}

export function createLoopRunner(runner: (args?: any) => Promise<boolean | void>, ms = 0, errorms = 2000) {
	let stop = false

	parentPort.on('message', async (_msg: Message) => {
		stop = _msg.stop
	});

	(async function () {
		await openDB()
		while (!stop) {
			try {
				if (await runner(workerData)) {
					break
				}
				await sleep(ms)
			} catch (e) {
				console.log(`LoopRunner ${runner.name}:`, e)
				await sleep(errorms)
			}
		}
	})()

}
