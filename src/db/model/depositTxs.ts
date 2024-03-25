import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table
export class DepositTxs extends Model {
	@Column({
		type: DataType.STRING,
		primaryKey: true
	})
	declare logHash: string

	@Column({ type: DataType.STRING })
	declare txHash: string

	@Column({ type: DataType.BIGINT })
	declare logIndex: number

	@Column({ type: DataType.STRING })
	declare srcChainId: string

	@Column({ type: DataType.STRING })
	declare dstChainId: string

	@Column({ type: DataType.STRING })
	declare from: string

	@Column({ type: DataType.STRING })
	declare to: string

	@Column({ type: DataType.STRING })
	declare amount: string

	@Column({ type: DataType.STRING })
	declare fee: string

	@Column({ type: DataType.BIGINT })
	declare timeoutAt: number

	@Column({ type: DataType.STRING })
	declare status: 'indexed' | 'confirmed' | 'unknown' | 'invalid' | 'unsupported-chain' | 'insufficient-funds' | 'initialized' | 'finalized' | 'timeout' | 'withdrawn'

	@Column({ type: DataType.BIGINT })
	declare blockNumber: string
}
