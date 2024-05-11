import { join } from "path";
import { Context } from "../config";
import Job from "../worker/job";

const runner = join(__dirname, './server.js')

let job: Job

export function startServerJob(context: Context) {
	job = new Job(runner, { workerData: context })
	job.start()
}

export function stopServerJob() {
	if (job) {
		job.stop()
	}
}