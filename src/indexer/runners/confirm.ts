import { Context } from '../../config'
import { DepositTxs } from '../../db/model/depositTxs'
import { Op } from 'sequelize'
import logger from '../../utils/logger'
import { IndexedBlocks } from '../../db/model/indexedBlocks'
import { JsonRpcProvider } from 'ethers'
import { createLoopRunner } from '../../worker/runner'
import { waitIndex } from '../utils'

createLoopRunner(confirm, 2000)

export async function confirm(chain: { chainId: string, context: Context }) {
	const { chainId, context } = chain
	await waitIndex(chainId, context)
	const config = context.allConfigs.get(chainId)
	const indexed = await IndexedBlocks.findOne({ where: { chainId } })
	const safeDepositBlock = indexed.latestBlock >= config.depositSafeBlockInterval ? indexed.latestBlock - config.depositSafeBlockInterval : 0
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
		const srcConfig = context.allConfigs.get(tx.srcChainId)
		const provider = new JsonRpcProvider(srcConfig.rpc)
		const recepit = await provider.getTransactionReceipt(tx.txHash)
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

}