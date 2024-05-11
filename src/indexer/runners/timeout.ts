import { Op } from 'sequelize'
import { Context } from '../../config'
import { DepositTxs } from '../../db/model/depositTxs'
import { IndexedBlocks } from '../../db/model/indexedBlocks'
import { JsonRpcProvider } from 'ethers'
import { ETHDeliver__factory } from '@simpledeliver/deliver-contracts'
import { createLoopRunner } from '../../worker/runner'
import { waitIndex } from '../utils'

createLoopRunner(timeout, 1000)

export async function timeout(chain: { chainId: string, context: Context }) {
	const { chainId, context } = chain
	await waitIndex(chainId, context)
	const initializedTxs = await DepositTxs.findAll({
		where: {
			status: { [Op.in]: ['initialized', 'confirmed', 'indexed'] },
			srcChainId: chainId,
		}
	})
	for (const tx of initializedTxs) {
		const dstConfig = context.allConfigs.get(tx.dstChainId)
		const block = await IndexedBlocks.findOne({ where: { chainId: tx.dstChainId } })
		const dstCurrentTime = block.latestBlockTimestamp
		const dstProvider = new JsonRpcProvider(dstConfig.rpc)
		const dstDeliver = ETHDeliver__factory.connect(dstConfig.deliver, dstProvider)
		if (tx.timeoutAt < dstCurrentTime) {
			const exists = await dstDeliver.finalizedTxs(tx.logHash)
			if (!exists) {
				await DepositTxs.update({ status: 'timeout' }, { where: { logHash: tx.logHash } })
			} else {
				await DepositTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
			}
		}
	}
}