import { getContext } from '../config'
import { DepositTxs } from '../db/model/depositTxs'
import { Op } from 'sequelize'
import logger from '../utils/logger'
import { sleep } from '../utils'

export async function confirm(chainId: string) {
	while (true) {
		try {
			const context = getContext(chainId)
			if (context.stop) {
				console.log(`confirm stopped:${chainId}`)
				break
			}
			const safeDepositBlock = context.lastestBlock.number >= context.depositSafeBlockInterval ? context.lastestBlock.number - context.depositSafeBlockInterval : 0
			const deposits = await DepositTxs.findAll({
				where: {
					blockNumber: {
						[Op.lte]: safeDepositBlock
					},
					srcChainId: chainId,
					status: 'indexed'
				}
			})
			for (const tx of deposits) {
				const srcContext = getContext(tx.srcChainId)
				const recepit = await srcContext.provider.getTransactionReceipt(tx.txHash)
				if (!recepit) {
					// tx removed by reorg or rpc wrong
					await DepositTxs.update({ status: 'invalid' }, { where: { logHash: tx.logHash } })
					logger.error('deposit removed by reorg:', tx)
					continue
				}
				if (recepit.status == 1) {
					logger.info('tx confirmed:', tx)
					await DepositTxs.update({ status: 'confirmed' }, { where: { logHash: tx.logHash } })
				} else {
					// unkown deposit
					await DepositTxs.update({ status: 'unknown' }, { where: { logHash: tx.logHash } })
					logger.error('deposit removed by tx revert:', tx)
					continue
				}
			}
			await sleep(1000)
		} catch (e) {
			if (getContext(chainId).stop) { break }
			logger.error('confirm failed:', e)
			await sleep(5000)
		}
	}

}