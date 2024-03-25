import { Op } from 'sequelize'
import { sleep } from '../utils'
import { getContext } from '../config'
import { DepositTxs } from '../db/model/depositTxs'
import logger from '../utils/logger'

export async function timeout(chainId: string) {
	while (true) {
		try {
			const context = getContext(chainId)
			if (context.stop) {
				console.log(`timeout stopped:${chainId}`)
				break
			}
			const initializedTxs = await DepositTxs.findAll({
				where: {
					status: { [Op.in]: ['initialized', 'confirmed', 'indexed'] },
					srcChainId: chainId,
				}
			})
			for (const tx of initializedTxs) {
				const dstContext = getContext(tx.dstChainId)
				const dstCurrentTime = dstContext.lastestBlock.timestamp
				if (tx.timeoutAt < dstCurrentTime) {
					const exists = await dstContext.deliver.finalizedTxs(tx.logHash)
					if (!exists) {
						await DepositTxs.update({ status: 'timeout' }, { where: { logHash: tx.logHash } })
					} else {
						await DepositTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
					}
				}
			}
			await sleep(1000)
		} catch (e) {
			if (getContext(chainId).stop) { break }
			logger.error('timeout failed:', e)
			await sleep(5000)
		}
	}
}