import { recoverAddress, TypedDataEncoder, ZeroAddress, ZeroHash } from 'ethers'
import { getContext } from '../../config'
import { DepositTxs } from '../../db/model/depositTxs'
import { Withdrawals } from '../../db/model/withdrawals'
import Errors from '../errors/errors'

type AdminSig = string

export default class Deposits {

	public static async apply(
		chainId: string,
		logHash: string,
		depositor: string,
		amount: string,
		depositorSig: string
	): Promise<AdminSig> {
		const context = getContext(chainId)
		if (!context) {
			throw Errors.BAD_REQUEST.with(`${chainId} is not supported`)
		}
		let r = await Withdrawals.findOne({ where: { logHash } })
		if (r) {
			throw Errors.BAD_REQUEST.with(`${logHash} is already ${r.status}`)
		}
		const exists = await context.deliver.depositorWithdrawals(logHash)
		if (exists) {
			throw Errors.BAD_REQUEST.with(`withdrawl already sent, wait to indexed`)
		}
		const tx = await DepositTxs.findOne({ where: { logHash } })
		if (!tx) {
			throw Errors.NOT_FOUND.with('deposit not found')
		}
		if (tx.status != 'timeout') {
			throw Errors.FORBIDDEN.with('only expired deposits can be withdrawn')
		}
		if (amount != tx.amount) {
			throw Errors.FORBIDDEN.with('amount mismatch')
		}
		const domain = {
			name: 'ETHDELIVER',
			version: 'v1',
			chainId,
			verifyingContract: context.deliver.target as string
		}
		const types = {
			DepositorWithdrawal: [
				{
					name: 'logHash',
					type: 'bytes32'
				},
				{
					name: 'depositor',
					type: 'address'
				},
				{
					name: 'amount',
					type: 'uint256'
				}
			]
		}
		const payload = { logHash, depositor, amount }
		const hash = TypedDataEncoder.hash(domain, types, payload)
		const from = recoverAddress(hash, depositorSig)
		if (from.toLocaleLowerCase() !== depositor.toLocaleLowerCase() || from.toLocaleLowerCase() != tx.from.toLocaleLowerCase()) {
			throw Errors.FORBIDDEN.with('signer is not the depositor')
		}
		const adminSig = await context.guardian.signTypedData(domain, types, payload)
		return adminSig
	}

	public static async estimateDeposit(
		srcChainId: string,
		dstChainId: string,
		amount: string
	) {
		const srcContext = getContext(srcChainId)
		if (!srcContext) {
			throw Errors.BAD_REQUEST.with(`${srcChainId} is not supported`)
		}
		const dstContext = getContext(dstChainId)
		if (!dstContext) {
			throw Errors.BAD_REQUEST.with(`${dstChainId} is not supported`)
		}
		const received = BigInt(amount)
		const depositFee = await srcContext.deliver.depositFee(received)
		if (received <= depositFee) {
			throw Errors.BAD_REQUEST.with(`received ${received} is less than depositFee ${depositFee}`)
		}
		const txBody = {
			srcChainId,
			logHash: ZeroHash, // never exists
			to: ZeroAddress,
			amount,
			timeoutAt: Math.floor(Date.now() / 1000) + 86400
		}
		const gas = await dstContext.deliver.finalize.estimateGas(txBody)
		const feeData = await dstContext.provider.getFeeData()
		const gasLimit = gas * BigInt(dstContext.finalizeTxGasLimitCap) / 100n
		const gasPrice = feeData.gasPrice! * BigInt(dstContext.finalizeTxGasPriceCap) / 100n
		const estimateFinalizeTxFee = gasLimit * gasPrice
		if (received - depositFee <= estimateFinalizeTxFee) {
			throw Errors.BAD_REQUEST.with(`estimate finalized ${received - depositFee} is less than estimateFinalizeTxFee ${estimateFinalizeTxFee}`)
		}
		const estimateAmt = received - depositFee - estimateFinalizeTxFee
		const dstPoolBalance = await dstContext.provider.getBalance(dstContext.deliver.target)
		if (estimateAmt > dstPoolBalance) {
			throw Errors.BAD_REQUEST.with(`estimateAmt ${estimateAmt} is greater than dst pool balance ${dstPoolBalance}`)
		}
		return {
			srcChainId,
			dstChainId,
			amount: amount.toString(),
			depositFee: depositFee.toString(),
			estimateFinalizeTxFee: estimateFinalizeTxFee.toString(),
			estimateAmt: estimateAmt.toString(),
			dstPoolBalance: dstPoolBalance.toString()
		}
	}
}