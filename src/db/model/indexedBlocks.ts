import { Model, DataType, Table, Column } from 'sequelize-typescript'

@Table
export class IndexedBlocks extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare chainId: string

	@Column({ type: DataType.BIGINT })
	declare indexedBlock: number

	@Column({ type: DataType.BIGINT })
	declare latestBlock: number

	@Column({ type: DataType.BIGINT })
	declare latestBlockTimestamp: number
}