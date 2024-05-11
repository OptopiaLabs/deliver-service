import * as Koa from 'koa';
import logger from '../../utils/logger'
import Errors from '../errors/errors'
import { Context } from '../../config';

export function createContextMiddleware(context: Context) {
	return async (ctx: Koa.ParameterizedContext<any, {}>, next: () => Promise<any>) => {
		ctx.request.body.context = context
		await next()
	}
}

export const requestMiddleware = async (ctx: Koa.ParameterizedContext<any, {}>, next: () => Promise<any>) => {
	try {
		await next()
		if (ctx.status == 200) {
			ctx.body = {
				code: 200,
				data: ctx.body
			}
		} else if (ctx.status == 500) {
			ctx.body = {
				code: 500,
				message: "server error"
			}
		}
	} catch (err) {
		if (err instanceof Errors) {
			ctx.status = err.httpCode
		} else {
			ctx.status = 500
			logger.error("server error: ", err)
		}
		ctx.body = {
			code: err.code,
			message: err.message || err.toString()
		}
	}
}