import Router = require('@koa/router')
import { globSync } from 'glob'
import { join } from 'path'

const routerFiles = globSync([join(__dirname, 'routes/**.ts'), join(__dirname, 'routes/**.js')], { ignore: [join(__dirname, 'routes/index.ts'), join(__dirname, 'routes/index.js')] })

const routers: Router[] = []

for (const file of routerFiles) {
	const router = require(file)
	routers.push(router)
}

export default routers