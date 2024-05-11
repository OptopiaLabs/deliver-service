import Application = require('koa')
import cors = require('@koa/cors')

import { koaBody } from 'koa-body'
import { Server } from 'http'
import { requestMiddleware, createContextMiddleware } from './middleware'
import { createSimpleRunner } from '../worker/runner'
import routers from './routers'
import { Context } from '../config'
import { openDB } from '../db'

createSimpleRunner({
	start: startServer,
	stop: stopServer
})

const app = new Application()
let server: Server

export async function startServer(context: Context) {
	await openDB()
	app.use(cors({
		origin: process.env.CORS || "*"
	}))
		.use(koaBody())

	app.use(createContextMiddleware(context))

	for (const router of routers) {
		app.use(router.allowedMethods())
		app.use(router.routes())
	}


	app.use(requestMiddleware)
	app.middleware.unshift(requestMiddleware)

	const port = process.env.API_PORT || 3000

	console.log("Server running on port " + port)
	server = app.listen(port)
}

export function stopServer() {
	server.close()
}

