import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table
export class Withdrawals extends Model {
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
	declare chainId: string

	@Column({ type: DataType.STRING })
	declare depositor: string

	@Column({ type: DataType.STRING })
	declare amount: string

	@Column({ type: DataType.STRING })
	declare depositorSig: string

	@Column({ type: DataType.STRING })
	declare guarndianSig: string

	@Column({ type: DataType.STRING })
	declare status: 'indexed' | 'invalid' | 'finalized'

	@Column({ type: DataType.BIGINT })
	declare blockNumber: string
}
