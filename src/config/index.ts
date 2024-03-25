
import { ETHDeliver, ETHDeliver__factory } from '@simpledeliver/contracts'
import { Block, JsonRpcProvider, Provider, Signer, Wallet } from 'ethers'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { assert } from 'console'
import { IndexedBlocks } from '../db/model/indexedBlocks'
import { load } from 'js-yaml'
import logger from '../utils/logger'

const AllContext: [string: Context] = Object.create({})
export let allChains: string[] = []

type RelayerConfig = {
	relayer: string
	admin: string
	rpc: string
	deliver: string
	startBlock: number
	maxPollBlocks: number
	latestBlockPollTimeInterval: number
	depositSafeBlockInterval: number
	finalizeSafeBlockInterval: number
	finalizeTxGasLimitCap: number
	finalizeTxGasPriceCap: number
}

export interface Context {
	signer: Signer // relayer
	admin: Signer
	provider: Provider
	chainId: string
	deliver: ETHDeliver
	maxPCT: bigint
	depositBaseFee: bigint
	depositFeeRate: bigint
	finalizeTxGas: bigint
	depositSafeBlockInterval: number
	finalizeSafeBlockInterval: number
	lastestBlock: Block
	maxPollBlocks: number
	latestBlockPollTimeInterval: number
	finalizeTxGasLimitCap: number
	finalizeTxGasPriceCap: number
	stop: boolean
}

export async function initContext() {
	const configPath = process.env.CONFIGPATH ?? join(__dirname, '../../config.yml')
	if (!existsSync(configPath)) {
		throw 'nonexistent config'
	}
	const configFile = readFileSync(configPath, 'utf8')
	const data: any = load(configFile)
	const cfgs: [string: RelayerConfig] = data
	const chainIds = Object.keys(cfgs)
	const values = Object.values(cfgs)
	for (let i = 0; i < values.length; i++) {
		const chainId = chainIds[i]
		const value = values[i]
		try {
			const rpc = value.rpc
			const provider = new JsonRpcProvider(rpc)
			const network = await provider.getNetwork()
			const id = network.chainId
			assert(id.toString() == chainId, `inconsistent chain id ${chainId} ${id}`)
			const relayerPhase = value.relayer
			assert(!!relayerPhase, 'invalid relayer phase')
			const adminPhase = value.admin
			assert(!!adminPhase, 'invalid admin phase')
			const signer = Wallet.fromPhrase(relayerPhase).connect(provider)
			const admin = Wallet.fromPhrase(adminPhase).connect(provider)
			const deliver = ETHDeliver__factory.connect(value.deliver, signer)
			const config = await deliver.config()
			const maxPCT = await deliver.MAXPCT();
			const lastestBlock = await provider.getBlock('latest')
			const indexed = await IndexedBlocks.findOne({ where: { chainId } })
			if (!indexed?.dataValues) {
				await IndexedBlocks.upsert({ chainId, indexedBlock: value.startBlock })
			}
			const context: Context = {
				deliver,
				signer,
				admin,
				provider,
				chainId,
				maxPCT,
				lastestBlock,
				depositSafeBlockInterval: value.depositSafeBlockInterval,
				finalizeSafeBlockInterval: value.finalizeSafeBlockInterval,
				maxPollBlocks: value.maxPollBlocks,
				latestBlockPollTimeInterval: value.latestBlockPollTimeInterval,
				finalizeTxGasLimitCap: value.finalizeTxGasLimitCap,
				finalizeTxGasPriceCap: value.finalizeTxGasPriceCap,
				stop: false,
				...config
			}
			Object.defineProperty(AllContext, chainId, { value: context, writable: true, configurable: true, enumerable: true })
			allChains = Object.keys(AllContext)
		} catch (e) {
			logger.error('context init failed:', chainId, value)
			throw e
		}
	}
}

export function getContext(chainId: string): Context | null {
	const key = chainId as keyof typeof AllContext;
	return AllContext[key] as Context
}

export function setContext(chainId: string, context: Context) {
	Object.defineProperty(AllContext, chainId, { value: context, writable: true, configurable: true, enumerable: true })
}

export function stopAll() {
	for (const chainId of allChains) {
		const context = getContext(chainId)
		context.stop = true
		setContext(chainId, context)
	}
}