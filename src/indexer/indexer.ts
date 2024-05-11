import { Context } from '../config'
import { globSync } from 'glob'
import { join } from 'path'
import Job from '../worker/job'

const files = [join(__dirname, './runners/**.ts'), join(__dirname, './runners/**.js')]
const runners = globSync(files)

const jobs: Job[] = []

export function startIndexer(context: Context) {
	const allChains = context.allChains
	allChains.forEach((chainId) => {
		runners.forEach((runner) => {
			const job = new Job(runner, { workerData: { chainId, context } })
			job.start()
			jobs.push(job)
		})
	})
}

export function stopIndexer() {
	for (const job of jobs) {
		job.stop()
	}
}
