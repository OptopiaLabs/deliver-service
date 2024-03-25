export async function sleep(ms: number) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve(1)
		}, ms);
	})
}

export async function stuck() {
	await sleep(0xffffff)
}