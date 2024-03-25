import { allChains } from '../config'
import { index } from './index'
import { initialize } from './initialize'
import { finalize } from './finalize'
import { confirm } from './confirm'
import { pollBlock } from './pollBlock'
import { timeout } from './timeout'
import { indexWithdrawals } from './withdrawal'

export function startIndexer() {
	for (const chainId of allChains) {
		pollBlock(chainId)
		index(chainId)
		confirm(chainId)
		initialize(chainId)
		timeout(chainId)
		indexWithdrawals(chainId)
		finalize(chainId)
	}
}
