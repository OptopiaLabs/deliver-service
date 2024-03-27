import Router = require('@koa/router')
import Deposits from '../services/deposits'

const router = new Router()

router.post('/deposits/withdrawal/apply', async (ctx) => {
	const {
		chainId,
		logHash,
		depositor,
		amount,
		depositorSig
	} = ctx.request.body
	// TODO validate params
	const adminSig = await Deposits.apply(chainId, logHash, depositor, amount, depositorSig)
	ctx.body = adminSig
})

router.post('/deposits/estimate', async (ctx) => {
	const {
		srcChainId,
		dstChainId,
		amount
	} = ctx.request.body
	// TODO validate params
	const data = await Deposits.estimateDeposit(srcChainId, dstChainId, amount)
	ctx.body = data
})

module.exports = router
