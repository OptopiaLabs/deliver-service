import KoaRouter = require('@koa/router')
import Tx from '../services/txs'

const router = new KoaRouter()

router.get('/txs/:account', async (ctx) => {
	const { account } = ctx.params
	let { page, pageSize } = ctx.request.query
	// TODO validate params
	const txs = await Tx.get(account.toLocaleLowerCase(), Number(page || 0), Number(pageSize || 10))
	ctx.body = txs
})

module.exports = router
