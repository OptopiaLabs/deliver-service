import { sequelize } from '../../db'

interface Tx {
	logHash: string
	srcTxHash: string
	srcLogIndex: number
	srcChainId: string
	dstChainId: string
	from: string
	to: string
	depositAmount: string
	depositFee: string
	timeoutAt: number
	depositStatus: string
	depositBlockNumber: number
	finalizeTxHash: string
	finalizeLogIndex: number
	relayer: string
	finalizeAmount: string
	finalizeFee: string
	finalizeStatus: string
	finalizeBlockNumber: number
}

export default class Txs {

	public static async get(account: string, page: number, pageSize: number): Promise<Tx[]> {
		const txs = await sequelize.query<[Tx[], unknown]>(
			{
				query: `select dt."logHash", dt."txHash" srcTxHash, dt."logIndex" srcLogIndex, dt."srcChainId", dt."dstChainId", dt."from", dt."to", dt.amount as depositAmount, dt.fee depositFee, dt."timeoutAt" , dt.status depositStatus, dt."blockNumber" depositBlockNumber, ft."txHash" finalizeTxHash, ft."logIndex" finalizeLogIndex, ft.relayer, ft.amount finalizeAmount, ft.fee finalizeFee, ft.status finalizeStatus, ft."blockNumber" finalizeBlockNumber from "DepositTxs" dt left join "FinalizeTxs" ft on dt."logHash" = ft."logHash" where dt."from" = ? limit ? offset ?`,
				values: [account, pageSize, page * pageSize]
			},
			null
		)
		return txs[0]
	}
}