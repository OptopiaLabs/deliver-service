import { Log, solidityPackedKeccak256 } from 'ethers'
import { Context, getContext, setContext } from '../config'
import { DepositTxs } from '../db/model/depositTxs'
import { FinalizeTxs } from '../db/model/finalizeTxs'
import { Withdrawals } from '../db/model/withdrawals'
import { IndexedBlocks } from '../db/model/indexedBlocks'

import { sleep } from '../utils'
import logger from '../utils/logger'

export async function index(chainId: string) {
	const indexed = await IndexedBlocks.findOne({ where: { chainId } })
	let fromBlock = Number(indexed.indexedBlock)
	while (true) {
		try {
			const context = getContext(chainId)
			if (context.stop) {
				console.log(`index stopped:${chainId}`)
				break
			}
			const maxPollBlocks = Number(context.maxPollBlocks)
			const maxToBlock = fromBlock + maxPollBlocks
			const toBlock = maxToBlock <= context.lastestBlock.number ? maxToBlock : context.lastestBlock.number
			console.log('chainId:', chainId, 'index fromBlock:', fromBlock, 'toBlock:', toBlock)
			if (toBlock > fromBlock) {
				setContext(chainId, context)
				await processEvents(context, fromBlock, toBlock)
				await IndexedBlocks.upsert({ chainId: context.chainId, indexedBlock: toBlock })
				fromBlock = toBlock
			}
			if (toBlock - fromBlock != maxPollBlocks) {
				await sleep(context.latestBlockPollTimeInterval)
			}
		} catch (e) {
			if (getContext(chainId).stop) { break }
			logger.error('index failed:', e)
			await sleep(500)
		}
	}
}

async function processEvents(context: Context, fromBlock: number, toBlock: number) {
	const depositTopicHash = context.deliver.filters['Deposit'].fragment.topicHash
	const finalizeTopicHash = context.deliver.filters['Finalize'].fragment.topicHash
	const depositorWithdrawTopicHash = context.deliver.filters['DepositorWithdrawn'].fragment.topicHash
	const logs = await context.provider.getLogs({
		address: context.deliver.target,
		fromBlock,
		toBlock,
		topics: [[depositTopicHash, finalizeTopicHash, depositorWithdrawTopicHash]]
	})
	for (const log of logs) {
		if (log.topics[0] == depositTopicHash) {
			await processDepositLog(context, log)
		} else if (log.topics[0] == finalizeTopicHash) {
			await processFinalizeLog(context, log)
		} else if (log.topics[0] == depositorWithdrawTopicHash) {
			await processDepositorWithdrawnLog(context, log)
		} else {
			logger.info('index unknown event log:', log)
		}
	}
}

async function processDepositLog(context: Context, log: Log) {
	// event Deposit(uint256 srcChainId, uint256 dstChainId, address from, address to, uint256 amount, uint256 fee);
	const meta = context.deliver.interface.decodeEventLog('Deposit', log.data, log.topics)
	const txHash = log.transactionHash.toLocaleLowerCase()
	const logIndex = log.index
	const srcChainId = meta[0]
	const dstChainId = meta[1]
	const from = meta[2].toLocaleLowerCase()
	const to = meta[3].toLocaleLowerCase()
	const amount = BigInt(meta[4]).toString()
	const fee = BigInt(meta[5]).toString()
	const timeoutAt = Number(meta[6])
	const blockNumber = log.blockNumber
	const logHash = solidityPackedKeccak256(['bytes32', 'uint256'], [txHash, logIndex])
	const isSupported = !!getContext(srcChainId) && !!getContext(dstChainId)
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
		status: isSupported ? 'indexed' : 'unsupported-chain'
	}
	const exists = await DepositTxs.findOne({ where: { logHash } })
	if (!exists) {
		await DepositTxs.create(depositTx)
	}
}

async function processFinalizeLog(context: Context, log: Log) {
	// event Finalize(address relayer, uint256 srcChainId, uint256 dstChainId, bytes32 logHash, address to, uint256 amount, uint256 fee);
	const meta = context.deliver.interface.decodeEventLog('Finalize', log.data, log.topics)
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
		status: 'indexed'
	}
	const exists = await FinalizeTxs.findOne({ where: { logHash } })
	if (!exists) {
		await FinalizeTxs.create(finalizeTx)
	}
}

async function processDepositorWithdrawnLog(context: Context, log: Log) {
	// event Finalize(address relayer, uint256 srcChainId, uint256 dstChainId, bytes32 logHash, address to, uint256 amount, uint256 fee);
	const meta = context.deliver.interface.decodeEventLog('DepositorWithdrawn', log.data, log.topics)
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
	const chainId = context.chainId
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
	const exists = await Withdrawals.findOne({ where: { logHash } })
	if (!exists) {
		await Withdrawals.create(depositorWithdrawal)
	}
}