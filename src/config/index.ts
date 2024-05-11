
import { ETHDeliver, ETHDeliver__factory } from '@simpledeliver/deliver-contracts'
import { JsonRpcProvider, Provider, Signer, Wallet } from 'ethers'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { assert } from 'console'
import { IndexedBlocks } from '../db/model/indexedBlocks'
import { load } from 'js-yaml'
import logger from '../utils/logger'

interface Config {
	relayer: string
	guardian: string
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

export class Context {
	allConfigs = new Map<string, Config>()

	public addChain(chain: string, config: Config) {
		this.allConfigs.set(chain, config)
	}

	getConfig(chain: string) {
		return this.allConfigs.get(chain)
	}

	get allChains() {
		return Array.from(this.allConfigs.keys())
	}

	public isSupported(chain: string) {
		return !!this.allConfigs.get(chain)
	}
}

export async function initContext() {
	const configPath = process.env.CONFIGPATH ?? join(__dirname, '../../config.yaml')
	if (!existsSync(configPath)) {
		throw 'nonexistent config'
	}
	const configFile = readFileSync(configPath, 'utf8')
	const data: any = load(configFile)
	const cfgs: [string: Config] = data
	const chainIds = Object.keys(cfgs)
	const values = Object.values(cfgs)
	const allContext: Context = new Context()
	for (let i = 0; i < values.length; i++) {
		const chainId = chainIds[i].toString()
		const value = values[i]
		try {
			const rpc = value.rpc
			const provider = new JsonRpcProvider(rpc)
			const network = await provider.getNetwork()
			const id = network.chainId
			assert(id.toString() == chainId, `inconsistent chain id ${chainId} ${id}`)
			const relayerPhase = value.relayer
			assert(!!relayerPhase, 'invalid relayer phase')
			const guardianPhase = value.guardian
			assert(!!guardianPhase, 'invalid guardian phase')
			const signer = Wallet.fromPhrase(relayerPhase).connect(provider)
			const guardian = Wallet.fromPhrase(guardianPhase).connect(provider)
			const deliver = ETHDeliver__factory.connect(value.deliver, signer)
			const g = await deliver.guardian()
			assert(g.toLocaleLowerCase() == guardian.address.toLocaleLowerCase(), 'guardian required to sign depositor withdrawal')
			const latestBlock = await provider.getBlock('latest')
			const indexed = await IndexedBlocks.findOne({ where: { chainId } })
			if (!indexed?.dataValues) {
				await IndexedBlocks.upsert({ chainId, indexedBlock: value.startBlock, latestBlock: latestBlock.number, latestBlockTimestamp: latestBlock.timestamp })
			}
			allContext.addChain(chainId, value)
		} catch (e) {
			logger.error('context init failed:', chainId, value)
			throw e
		}
	}

	return allContext
}