import { getContext } from '../config'
import { DepositTxs } from '../db/model/depositTxs'
import { sleep } from '../utils'
import { sequelize } from '../db'
import logger from '../utils/logger'

export async function initialize(chainId: string) {
	while (true) {
		try {
			const context = getContext(chainId)
			if (context.stop) {
				console.log(`initialize stopped:${chainId}`)
				break
			}
			const confirmedTxs = await DepositTxs.findAll({
				where: {
					status: 'confirmed',
					srcChainId: chainId,
				}
			})
			for (const tx of confirmedTxs) {
				const dstChainId = tx.dstChainId
				const dstContext = getContext(dstChainId)
				if (!dstContext) {
					await DepositTxs.update({ status: 'unsupported-chain' }, { where: { logHash: tx.logHash } })
					continue
				}
				const initialized = await dstContext.deliver.finalizedTxs(tx.logHash)
				if (initialized) {
					await DepositTxs.update({ status: 'initialized' }, { where: { logHash: tx.logHash } })
					continue
				}
				const srcContext = getContext(tx.srcChainId)
				const receipt = await srcContext.provider.getTransactionReceipt(tx.txHash)
				if (!receipt) {
					// deposit removed by reorg or rpc wrong
					await DepositTxs.update({ status: 'invalid' }, { where: { logHash: tx.logHash } })
					logger.info('confirmed deposit removed by reorg:', tx)
					continue
				}
				if (receipt.status == 1) {
					while (true) {
						try {
							const poolBalance = await dstContext.provider.getBalance(context.deliver.target)
							if (poolBalance < BigInt(tx.amount)) {
								await DepositTxs.update({ status: 'insufficient-funds' }, { where: { logHash: tx.logHash } })
								break
							}

							const txBody = {
								srcChainId: tx.srcChainId,
								logHash: tx.logHash,
								to: tx.to,
								amount: tx.amount,
								timeoutAt: tx.timeoutAt
							}
							const initialized = await dstContext.deliver.finalizedTxs(tx.logHash)
							if (initialized) {
								logger.info('tx already initialized:', tx)
								await DepositTxs.update({ status: 'initialized' }, { where: { logHash: tx.logHash } })
								break
							}
							const gas = await dstContext.deliver.finalize.estimateGas(txBody)
							const feeData = await dstContext.provider.getFeeData()
							const t = await sequelize.transaction();
							try {
								await DepositTxs.update({ status: 'initialized' }, { where: { logHash: tx.logHash } })
								const transaction = await dstContext.deliver.finalize(
									txBody,
									{
										gasLimit: gas * BigInt(dstContext.finalizeTxGasLimitCap) / 100n,
										gasPrice: feeData.gasPrice * BigInt(dstContext.finalizeTxGasPriceCap) / 100n
									}
								)
								logger.info('tx initialized:', tx)
								await t.commit();
							} catch (error) {
								await t.rollback();
							}
							break
						} catch (e) {
							logger.error('initialize tx failed:', e)
							await sleep(10000)
						}
					}
				} else {
					// unkown deposit
					logger.error('unknown deposit:', tx)
					await DepositTxs.update({ status: 'unknown' }, { where: { logHash: tx.logHash } })
					continue
				}
			}
			await sleep(1000)
		} catch (e) {
			if (getContext(chainId).stop) { break }
			logger.error('initialize failed:', e)
			await sleep(5000)
		}
	}
}