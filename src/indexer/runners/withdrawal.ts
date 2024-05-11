import { Withdrawals } from '../../db/model/withdrawals'
import { Context } from '../../config'
import { Op } from 'sequelize'
import { DepositTxs } from '../../db/model/depositTxs'
import { sequelize } from '../../db'
import logger from '../../utils/logger'
import { IndexedBlocks } from '../../db/model/indexedBlocks'
import { JsonRpcProvider } from 'ethers'
import { waitIndex } from '../utils'

export async function indexWithdrawals(chain: { chainId: string, context: Context }) {
	const { chainId, context } = chain
	await waitIndex(chainId, context)
	const block = await IndexedBlocks.findOne({ where: { chainId } })
	const config = context.allConfigs.get(chainId)
	const safeDepositBlock = block.latestBlock >= config.depositSafeBlockInterval ? block.latestBlock - config.depositSafeBlockInterval : 0
	const withdrawals = await Withdrawals.findAll({
		where: {
			chainId,
			status: 'indexed',
			blockNumber: {
				[Op.lte]: safeDepositBlock
			},
		}
	})
	const provider = new JsonRpcProvider(config.rpc)
	for (const tx of withdrawals) {
		const recepit = await provider.getTransactionReceipt(tx.txHash)
		if (!recepit) {
			// tx removed by reorg or rpc wrong
			await Withdrawals.update({ status: 'invalid' }, { where: { logHash: tx.logHash } })
			logger.error('Withdrawals removed by reorg:', tx)
			continue
		}
		if (recepit.status == 1) {
			const t = await sequelize.transaction()
			try {
				await Withdrawals.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
				await DepositTxs.update({ status: 'withdrawn' }, { where: { logHash: tx.logHash } })
				await t.commit()
				logger.info('withdrawl finalized:', tx)
			} catch (e) {
				await t.rollback()
			}
		}
	}
}