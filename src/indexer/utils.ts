import { IndexedBlocks } from "../db/model/indexedBlocks";
import { Context } from "../config";
import { sleep } from "../utils";

export async function waitIndex(chainId: string, context: Context, ms = 1000) {
	while (true) {
		const config = context.allConfigs.get(chainId)
		const block = await IndexedBlocks.findOne({ where: { chainId } })
		if (block) {
			if (block.latestBlock - block.indexedBlock <= config.depositSafeBlockInterval) {
				break
			}
		}
		await sleep(1000)
	}

}

export function isSupportedChain(chainId: string, context: Context) {
	return !!context.allConfigs.get(chainId)
}