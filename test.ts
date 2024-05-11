import * as Router from "@koa/router";
import "reflect-metadata"
export const routers: Router[] = []

function setValue(o: unknown, prop: string, value: any) {
	Object.defineProperty(o, prop, {
		enumerable: true,
		configurable: true,
		value,
		writable: true
	})
}

function getValue<T>(o: unknown, prop: string): T {
	const obj = o as any
	const ob = Object.getPrototypeOf(o)
	console.log('ob', ob, ob[prop])
	return ob[prop]
}

function ParamTypes(c?: { prefix: string }) { return Reflect.metadata("design:paramtypes", c); }

// function Controller<T extends { new(...args: any[]): {} }>(constructor: T) {
// 	return class extends constructor {
// 		router = new Router()
// 	}
// }
function Controller(c?: Router.RouterOptions) {
	const router = new Router(c)

	return (target: Function) => {
		Reflect.defineMetadata("Controller", router, target);

		// const router = new Router(c)
		// Reflect.metadata('router', router)
		// setValue(target.prototype, 'router', router)
		// routers.push(router)
		// Reflect.defineMetadata('Controller', router, target.prototype, 'router');
		console.log('Controller target', target.prototype.router)
		target.prototype.router = router
		// return Reflect.defineMetadata('router', router, target)
	}
}

function Route(c?: any) {
	// return (target: Object, propertyKey: any) => {
	return function (target: any, propertyKey: any) {
		// const router = Reflect.getMetadata(target, 'router')
		console.log('target', target)
		// let paramTypes = Reflect.getMetadata('Controller', target, 'router')
		// console.log('paramTypes', paramTypes)
		// console.log('Route Controller target', target.prototype.router)

		// console.log('target', target, descriptor.value)
		// const router = getValue<Router>(target, 'router')
		// console.log('Route', router)
		// console.log('propertyKey', propertyKey)
	}
}

@Controller
class User {
	@Route()
	test() {
		console.log('test')
	}
}

const user = new User()

console.log('router', (user as any).router)
user.test()
