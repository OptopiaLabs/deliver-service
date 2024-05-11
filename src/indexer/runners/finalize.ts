import { Context } from '../../config'
import logger from '../../utils/logger'
import { FinalizeTxs } from '../../db/model/finalizeTxs'
import { Op } from 'sequelize'
import { DepositTxs } from '../../db/model/depositTxs'
import { sequelize } from '../../db'
import { IndexedBlocks } from '../../db/model/indexedBlocks'
import { JsonRpcProvider } from 'ethers'
import { createLoopRunner } from '../../worker/runner'
import { waitIndex } from '../utils'

createLoopRunner(finalize, 1000)

export async function finalize(chain: { chainId: string, context: Context }) {
	const { chainId, context } = chain
	await waitIndex(chainId, context)
	const block = await IndexedBlocks.findOne({ where: { chainId: chainId } })
	const config = context.allConfigs.get(chainId)
	const finalizeSafeBlockInterval = block.latestBlock >= config.finalizeSafeBlockInterval ? block.latestBlock - config.finalizeSafeBlockInterval : 0
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
		const dstConfig = context.allConfigs.get(tx.dstChainId)
		const dstProvider = new JsonRpcProvider(dstConfig.rpc)
		const recepit = await dstProvider.getTransactionReceipt(tx.txHash)
		if (!recepit) {
			// tx removed by reorg or rpc wrong
			await FinalizeTxs.update({ status: 'invalid' }, { where: { logHash: tx.logHash } })
			logger.error('FinalizeTx removed by reorg:', tx)
			continue
		}
		if (recepit.status == 1) {
			logger.info('tx finalized:', tx)
			const transaction = await sequelize.transaction()
			try {
				await DepositTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
				await FinalizeTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
				transaction.commit()
			} catch (e) {
				transaction.rollback()
			}
		} else {
			// unkown deposit
			await FinalizeTxs.update({ status: 'unknown' }, { where: { logHash: tx.logHash } })
			logger.error('FinalizeTx removed by tx revert:', tx)
			continue
		}
	}
}