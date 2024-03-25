export default class Errors extends Error {

	public static BAD_REQUEST = new Errors(400, 'Bad Request', 300)

	public static FORBIDDEN = new Errors(403, 'Forbidden', 400)

	public static NOT_FOUND = new Errors(404, 'Not found', 500)

	constructor (public httpCode: number, message: string, public code: number) {
		super(message)
	}

	public with(msg?: string, code?: number) {
		if (msg) {
			this.message = msg
		}
		if (code) {
			this.code = code
		}
		return this
	}

}