import Router = require('@koa/router')
import Tx from '../services/txs'

const router = new Router()

router.get('/txs/:account', async (ctx) => {
	const { account } = ctx.params
	let { chainId, page, pageSize } = ctx.request.query
	// TODO validate params
	const txs = await Tx.get(chainId as string, account.toLocaleLowerCase(), Number(page || 0), Number(pageSize || 10))
	ctx.body = txs
})

module.exports = router
