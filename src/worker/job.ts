import { Worker, WorkerOptions } from 'node:worker_threads'

export default class Job {
	private worker: Worker

	constructor (w: string, options?: WorkerOptions) {
		this.worker = new Worker(w, options)
	}

	public async start(data?: any) {
		return this.worker.postMessage({ stop: false, data })
	}

	public async stop(data?: any) {
		return this.worker.postMessage({ stop: true, data })
	}
}