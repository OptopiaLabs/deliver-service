import { Context } from '../../config'
import { DepositTxs } from '../../db/model/depositTxs'
import { sleep } from '../../utils'
import { sequelize } from '../../db'
import logger from '../../utils/logger'
import { FinalizeTxs } from '../../db/model/finalizeTxs'
import { JsonRpcProvider, Wallet } from 'ethers'
import { ETHDeliver__factory } from '@simpledeliver/deliver-contracts'
import { IndexedBlocks } from '../../db/model/indexedBlocks'
import { createLoopRunner } from '../../worker/runner'
import { waitIndex } from '../utils'

createLoopRunner(initialize, 1000)

export async function initialize(chain: { chainId: string, context: Context }) {
	const { chainId, context } = chain
	await waitIndex(chainId, context)
	const confirmedTxs = await DepositTxs.findAll({
		where: {
			status: 'confirmed',
			srcChainId: chainId,
		}
	})
	for (const tx of confirmedTxs) {
		const dstChainId = tx.dstChainId
		const dstConfig = context.allConfigs.get(dstChainId)
		if (!dstConfig) {
			await DepositTxs.update({ status: 'unsupported-chain' }, { where: { logHash: tx.logHash } })
			continue
		}
		const dstProvider = new JsonRpcProvider(dstConfig.rpc)
		const signer = Wallet.fromPhrase(dstConfig.relayer, dstProvider)
		const dstDeliver = ETHDeliver__factory.connect(dstConfig.deliver, signer)
		const initialized = await dstDeliver.finalizedTxs(tx.logHash)
		if (initialized) {
			await DepositTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
			continue
		}

		const srcConfig = context.allConfigs.get(tx.srcChainId)
		const srcProvider = new JsonRpcProvider(srcConfig.rpc)
		const receipt = await srcProvider.getTransactionReceipt(tx.txHash)
		if (!receipt) {
			// deposit removed by reorg or rpc wrong
			await DepositTxs.update({ status: 'invalid' }, { where: { logHash: tx.logHash } })
			logger.info('confirmed deposit removed by reorg:', tx)
			continue
		}
		if (receipt.status == 1) {
			while (true) {
				try {
					const poolBalance = await dstProvider.getBalance(dstConfig.deliver)
					if (poolBalance <= BigInt(tx.amount)) {
						await DepositTxs.update({ status: 'insufficient-funds' }, { where: { logHash: tx.logHash } })
						break
					}

					const finalize = await FinalizeTxs.findOne({ where: { logHash: tx.logHash } })
					if (finalize) {
						if (finalize.status == 'finalized') {
							await DepositTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
							break
						}
					}
					const initialized = await dstDeliver.finalizedTxs(tx.logHash)
					if (initialized) {
						// simple check currently
						logger.info('tx already finalized:', tx)
						await DepositTxs.update({ status: 'finalized' }, { where: { logHash: tx.logHash } })
						break
					}
					const dstBlock = await IndexedBlocks.findOne({ where: { chainId: dstChainId } })
					if (tx.timeoutAt <= dstBlock.latestBlockTimestamp) {
						await DepositTxs.update({ status: 'timeout' }, { where: { logHash: tx.logHash } })
						break
					}

					const txBody = {
						srcChainId: tx.srcChainId,
						logHash: tx.logHash,
						to: tx.to,
						amount: tx.amount,
						timeoutAt: tx.timeoutAt
					}

					const gas = await dstDeliver.finalize.estimateGas(txBody)
					const feeData = await dstProvider.getFeeData()
					const maxGasPrice = BigInt(1000e9)
					if (feeData.gasPrice > maxGasPrice) {
						await sleep(10000)
						continue
					}
					const t = await sequelize.transaction();
					try {
						await DepositTxs.update({ status: 'initialized' }, { where: { logHash: tx.logHash } })
						const transaction = await dstDeliver.finalize(
							txBody,
							{
								gasLimit: gas * BigInt(dstConfig.finalizeTxGasLimitCap) / 100n,
								gasPrice: feeData.gasPrice * BigInt(dstConfig.finalizeTxGasPriceCap) / 100n
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
}