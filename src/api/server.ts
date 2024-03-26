import Application = require('koa')
import cors = require('@koa/cors')

import { koaBody } from 'koa-body'
import { routers } from './routers'
import { Server } from 'http'
import { requestMiddleware } from './middleware'
import logger from '../utils/logger'

const app = new Application()
let server: Server

export function startServer() {
	app.use(cors({
		origin: process.env.CORS || "*"
	}))
		.use(koaBody())

	for (const router of routers) {
		app.use(router.allowedMethods())
		app.use(router.routes())
	}

	app.use(requestMiddleware)
	app.middleware.unshift(requestMiddleware)

	const port = process.env.API_PORT || 3000

	console.log("Server running on port " + port)
	logger.info("Server start runing:" + port)
	server = app.listen(port)
}

export function stopServer() {
	server.close()
}

