import KoaRouter = require('@koa/router')
import Tx from '../services/txs'

const router = new KoaRouter()

router.get('/txs/:account', async (ctx) => {
	const { account } = ctx.params
	const { page, pageSize } = ctx.request.query
	// TODO validate params
	const txs = await Tx.get(account.toLocaleLowerCase(), Number(page), Number(pageSize))
	ctx.body = txs
})

module.exports = router
