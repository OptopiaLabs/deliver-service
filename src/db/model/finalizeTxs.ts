import { Column, DataType, Model, Table } from 'sequelize-typescript'

@Table
export class FinalizeTxs extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare logHash: string

	@Column({ type: DataType.STRING })
	declare txHash: string

	@Column({ type: DataType.BIGINT })
	declare logIndex: number

	@Column({ type: DataType.STRING })
	declare relayer: string

	@Column({ type: DataType.STRING })
	declare srcChainId: string

	@Column({ type: DataType.STRING })
	declare dstChainId: string

	@Column({ type: DataType.STRING })
	declare to: string

	@Column({ type: DataType.STRING })
	declare amount: string

	@Column({ type: DataType.STRING })
	declare fee: string

	@Column({ type: DataType.STRING })
	declare status: 'indexed' | 'invalid' | 'unknown' | 'finalized'

	@Column({ type: DataType.BIGINT })
	declare blockNumber: number

	@Column({ type: DataType.BIGINT })
	declare blockTimestamp: number
}
