import { ETHDeliver, ETHDeliver__factory } from '@simpledeliver/deliver-contracts'
import { JsonRpcProvider, Log, Provider, solidityPackedKeccak256 } from 'ethers'
import { Context } from '../../config'
import { DepositTxs } from '../../db/model/depositTxs'
import { FinalizeTxs } from '../../db/model/finalizeTxs'
import { Withdrawals } from '../../db/model/withdrawals'
import { IndexedBlocks } from '../../db/model/indexedBlocks'
import { sequelize } from '../../db'
import { sleep } from '../../utils'
import logger from '../../utils/logger'
import { createLoopRunner } from '../../worker/runner'
import { Transaction } from 'sequelize'
import { isSupportedChain } from '../utils'

createLoopRunner(index)
export async function index(chain: { chainId: string, context: Context }) {
	const { chainId, context } = chain
	const config = context.allConfigs.get(chainId)
	const indexed = await IndexedBlocks.findOne({ where: { chainId } })
	const fromBlock = Number(indexed.indexedBlock)
	const maxPollBlocks = Number(config.maxPollBlocks)
	const maxToBlock = fromBlock + maxPollBlocks
	const toBlock = Number(maxToBlock <= indexed.latestBlock ? maxToBlock : indexed.latestBlock)
	console.log('chainId:', chainId, 'index fromBlock:', fromBlock, 'toBlock:', toBlock, 'latestBlock:', indexed.latestBlock)
	const provider = new JsonRpcProvider(config.rpc)
	const deliver = ETHDeliver__factory.connect(config.deliver, provider)
	if (toBlock > fromBlock) {
		const transaction = await sequelize.transaction()
		try {
			await processEvents(chainId, context, deliver, provider, fromBlock, toBlock, transaction)
			await IndexedBlocks.update({ indexedBlock: toBlock }, { where: { chainId }, transaction })
			await transaction.commit()
		} catch (e) {
			console.log(`index failed ${chainId}`, e)
			await transaction.rollback()
		}
	}
	if (toBlock - fromBlock != maxPollBlocks) {
		await sleep(config.latestBlockPollTimeInterval)
	}

}

async function processEvents(chainId: string, context: Context, deliver: ETHDeliver, provider: Provider, fromBlock: number, toBlock: number, transaction: Transaction) {
	const depositTopicHash = deliver.filters['Deposit'].fragment.topicHash
	const finalizeTopicHash = deliver.filters['Finalize'].fragment.topicHash
	const depositorWithdrawTopicHash = deliver.filters['DepositorWithdrawn'].fragment.topicHash
	const logs = await provider.getLogs({
		address: deliver.target,
		fromBlock,
		toBlock,
		topics: [[depositTopicHash, finalizeTopicHash, depositorWithdrawTopicHash]]
	})
	for (const log of logs) {
		if (log.topics[0] == depositTopicHash) {
			await processDepositLog(context, deliver, log, transaction)
		} else if (log.topics[0] == finalizeTopicHash) {
			await processFinalizeLog(deliver, log, transaction)
		} else if (log.topics[0] == depositorWithdrawTopicHash) {
			await processDepositorWithdrawnLog(chainId, deliver, log, transaction)
		} else {
			logger.info('index unknown event log:', log)
		}
	}
}

async function processDepositLog(context: Context, deliver: ETHDeliver, log: Log, transaction: Transaction) {
	// event Deposit(uint256 srcChainId, uint256 dstChainId, address from, address to, uint256 amount, uint256 fee);
	const meta = deliver.interface.decodeEventLog('Deposit', log.data, log.topics)
	const txHash = log.transactionHash.toLocaleLowerCase()
	const logIndex = log.index
	const srcChainId = meta[0].toString()
	const dstChainId = meta[1].toString()
	const from = meta[2].toLocaleLowerCase()
	const to = meta[3].toLocaleLowerCase()
	const amount = BigInt(meta[4]).toString()
	const fee = BigInt(meta[5]).toString()
	const timeoutAt = Number(meta[6])
	const blockNumber = log.blockNumber
	const block = await log.getBlock()
	const blockTimestamp = block.timestamp
	const logHash = solidityPackedKeccak256(['bytes32', 'uint256'], [txHash, logIndex])
	const isSupported = isSupportedChain(srcChainId, context) && isSupportedChain(dstChainId, context)
	const depositTx = {
		logHash,
		txHash,
		logIndex,
		srcChainId,
		dstChainId,
		from,
		to,
		amount,
		fee,
		timeoutAt,
		blockNumber,
		blockTimestamp,
		status: isSupported ? 'indexed' : 'unsupported-chain'
	}
	const exists = await DepositTxs.findOne({ where: { logHash }, transaction })
	if (!exists) {
		await DepositTxs.create(depositTx, { transaction })
	}
}

async function processFinalizeLog(deliver: ETHDeliver, log: Log, transaction: Transaction) {
	// event Finalize(address relayer, uint256 srcChainId, uint256 dstChainId, bytes32 logHash, address to, uint256 amount, uint256 fee);
	const meta = deliver.interface.decodeEventLog('Finalize', log.data, log.topics)
	const txHash = log.transactionHash
	const logIndex = log.index
	const relayer = meta[0].toLocaleLowerCase()
	const srcChainId = meta[1]
	const dstChainId = meta[2]
	const logHash = meta[3].toLocaleLowerCase()
	const to = meta[4].toLocaleLowerCase()
	const amount = BigInt(meta[5]).toString()
	const fee = BigInt(meta[6]).toString()
	const blockNumber = log.blockNumber
	const block = await log.getBlock()
	const blockTimestamp = block.timestamp
	const finalizeTx = {
		logHash,
		relayer,
		txHash,
		logIndex,
		srcChainId,
		dstChainId,
		to,
		amount,
		fee,
		blockNumber,
		blockTimestamp,
		status: 'indexed'
	}
	const exists = await FinalizeTxs.findOne({ where: { logHash }, transaction })
	if (!exists) {
		await FinalizeTxs.create(finalizeTx, { transaction })
	}
}

async function processDepositorWithdrawnLog(chainId: string, deliver: ETHDeliver, log: Log, transaction: Transaction) {
	// event Finalize(address relayer, uint256 srcChainId, uint256 dstChainId, bytes32 logHash, address to, uint256 amount, uint256 fee);
	const meta = deliver.interface.decodeEventLog('DepositorWithdrawn', log.data, log.topics)
	const txHash = log.transactionHash
	const logIndex = log.index
	const m = meta[0]
	const logHash = m[0].toLocaleLowerCase()
	const from = m[1].toLocaleLowerCase()
	const to = m[2].toLocaleLowerCase()
	const amount = m[3]
	const depositorSig = m[4].toLocaleLowerCase()
	const adminSig = m[5].toLocaleLowerCase()
	const blockNumber = log.blockNumber
	const depositorWithdrawal = {
		logHash,
		txHash,
		logIndex,
		chainId,
		from,
		to,
		amount,
		depositorSig,
		adminSig,
		blockNumber,
		status: 'indexed'
	}
	const exists = await Withdrawals.findOne({ where: { logHash }, transaction })
	if (!exists) {
		await Withdrawals.create(depositorWithdrawal, { transaction })
	}
}

