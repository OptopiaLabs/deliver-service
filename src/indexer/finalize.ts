import { getContext } from '../config'
import logger from '../utils/logger'
import { FinalizeTxs } from '../db/model/finalizeTxs'
import { Op } from 'sequelize'
import { sleep } from '../utils'
import { DepositTxs } from '../db/model/depositTxs'

export async function finalize(chainId: string) {
	while (true) {
		try {
			const context = getContext(chainId)
			if (context.stop) {
				console.log(`finalize stopped:${chainId}`)
				break
			}
			const finalizeSafeBlockInterval = context.lastestBlock.number >= context.finalizeSafeBlockInterval ? context.lastestBlock.number - context.finalizeSafeBlockInterval : 0
			const indexedTxs = await FinalizeTxs.findAll({
				where: {
					blockNumber: {
						[Op.lte]: finalizeSafeBlockInterval
					},
					dstChainId: chainId,
					status: 'indexed'
				}
			})
			for (const tx of indexedTxs) {
				const dstContext = getContext(tx.dstChainId)
				const recepit = await dstContext.provider.getTransactionReceipt(tx.txHash)
				if (!recepit) {
					// tx removed by reorg or rpc wrong
					await FinalizeTxs.update({ status: 'invalid' }, { where: { logHash: tx.logHash } })
					logger.error('FinalizeTx removed by reorg:', tx)
					continue
				}
				if (recepit.status == 1) {
					logger.info('tx finalized:', tx)
					await DepositTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
					await FinalizeTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
				} else {
					// unkown deposit
					await FinalizeTxs.update({ status: 'unknown' }, { where: { logHash: tx.logHash } })
					logger.error('FinalizeTx removed by tx revert:', tx)
					continue
				}
			}
			await sleep(1000)
		} catch (e) {
			if (getContext(chainId).stop) { break }
			logger.error('finalize failed:', e)
			await sleep(5000)
		}
	}
}