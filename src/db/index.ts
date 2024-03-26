import { Sequelize } from 'sequelize-typescript'
import { DepositTxs } from './model/depositTxs'
import { Withdrawals } from './model/withdrawals'
import { FinalizeTxs } from './model/finalizeTxs'
import { IndexedBlocks } from './model/indexedBlocks'

export const sequelize = new Sequelize(
	process.env.DB_NAME ?? 'deliver',
	process.env.DB_USER ?? 'postgres',
	process.env.DB_PASSWORD ?? '',
	{
		host: process.env.DB_HOST ?? 'localhost',
		dialect: 'postgres',
		models: [DepositTxs, Withdrawals, FinalizeTxs, IndexedBlocks],
		sync: { alter: true },
		logging: (sql: string) => {
			if (process.env.NODE_ENV === 'dev') {
				console.log(sql)
			}
		},
		port: Number(process.env.DB_PORT) || 5432
	}
)

export async function openDB() {
	await sequelize.sync({ alter: true })
}

export async function closeDB() {
	await sequelize.close()
}