import { Withdrawals } from '../db/model/withdrawals'
import { getContext } from '../config'
import { sleep } from '../utils'
import { Op } from 'sequelize'
import { DepositTxs } from '../db/model/depositTxs'
import { sequelize } from '../db'
import logger from '../utils/logger'

export async function indexWithdrawals(chainId: string) {
	while (true) {
		try {
			const context = getContext(chainId)
			if (context.stop) {
				console.log(`index withdrawals stopped:${chainId}`)
				break
			}
			const safeDepositBlock = context.lastestBlock.number >= context.depositSafeBlockInterval ? context.lastestBlock.number - context.depositSafeBlockInterval : 0
			const withdrawals = await Withdrawals.findAll({
				where: {
					chainId: context.chainId,
					status: 'indexed',
					blockNumber: {
						[Op.lte]: safeDepositBlock
					},
				}
			})
			for (const tx of withdrawals) {
				const recepit = await context.provider.getTransactionReceipt(tx.txHash)
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
		} catch (e) {
			if (getContext(chainId).stop) { break }
			logger.error('pollBlock failed:', e)
			await sleep(5000)
		}
	}
}