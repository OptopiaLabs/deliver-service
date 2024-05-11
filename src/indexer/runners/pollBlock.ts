import { JsonRpcProvider } from 'ethers'
import { Context } from '../../config'
import { sleep } from '../../utils'
import { IndexedBlocks } from '../../db/model/indexedBlocks'
import { createLoopRunner } from '../../worker/runner'

createLoopRunner(pollBlock)

export async function pollBlock(chain: { chainId: string, context: Context }) {
	const { chainId, context } = chain
	const config = context.allConfigs.get(chainId)
	const provider = new JsonRpcProvider(config.rpc)
	const latestBlock = await provider.getBlock('latest')
	await IndexedBlocks.update({ latestBlock: latestBlock.number, latestBlockTimestamp: latestBlock.timestamp }, { where: { chainId } })
	await sleep(config.latestBlockPollTimeInterval)
}