import { getContext } from '../config'
import { sleep } from '../utils'
import logger from '../utils/logger'

export async function pollBlock(chainId: string) {
	while (true) {
		try {
			const context = getContext(chainId)
			if (context.stop) {
				console.log(`pollBlock stopped:${chainId}`)
				break
			}
			context.lastestBlock = await context.provider.getBlock('latest')
			await sleep(context.latestBlockPollTimeInterval)
		} catch (e) {
			if (getContext(chainId).stop) { break }
			logger.error('pollBlock failed:', e)
			await sleep(5000)
		}
	}
}