import { JsonRpcProvider, recoverAddress, TypedDataEncoder, Wallet, ZeroAddress, ZeroHash } from 'ethers'
import { Context } from '../../config'
import { DepositTxs } from '../../db/model/depositTxs'
import { Withdrawals } from '../../db/model/withdrawals'
import Errors from '../errors/errors'
import { ETHDeliver__factory } from '@simpledeliver/deliver-contracts'

type AdminSig = string

export default class Deposits {

	public static async apply(
		context: Context,
		chainId: string,
		logHash: string,
		depositor: string,
		amount: string,
		depositorSig: string
	): Promise<AdminSig> {
		const config = context.allConfigs.get(chainId)
		if (!context) {
			throw Errors.BAD_REQUEST.with(`${chainId} is not supported`)
		}
		let r = await Withdrawals.findOne({ where: { logHash } })
		if (r) {
			throw Errors.BAD_REQUEST.with(`${logHash} is already ${r.status}`)
		}
		const provider = new JsonRpcProvider(config.rpc)
		const deliver = ETHDeliver__factory.connect(config.deliver, provider)
		const exists = await deliver.depositorWithdrawals(logHash)
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
			verifyingContract: deliver.target as string
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
		const guardian = Wallet.fromPhrase(config.guardian)
		const adminSig = await guardian.signTypedData(domain, types, payload)
		return adminSig
	}

	public static async estimateDeposit(
		context: Context,
		srcChainId: string,
		dstChainId: string,
		amount: string
	) {
		const srcConfig = context.allConfigs.get(srcChainId)
		if (!srcConfig) {
			throw Errors.BAD_REQUEST.with(`${srcChainId} is not supported`)
		}
		const dstConfig = context.allConfigs.get(dstChainId)
		if (!dstConfig) {
			throw Errors.BAD_REQUEST.with(`${dstChainId} is not supported`)
		}
		const received = BigInt(amount)
		const srcProvider = new JsonRpcProvider(srcConfig.rpc)
		const srcDeliver = ETHDeliver__factory.connect(srcConfig.deliver, srcProvider)
		const depositFee = await srcDeliver.depositFee(received)
		if (received <= depositFee) {
			throw Errors.BAD_REQUEST.with(`received ${received} is less than depositFee ${depositFee}`)
		}
		const txBody = {
			srcChainId,
			logHash: ZeroHash, // never exists
			to: ZeroAddress,
			amount: received - depositFee,
			timeoutAt: Math.floor(Date.now() / 1000) + 86400
		}

		const dstProvider = new JsonRpcProvider(dstConfig.rpc)
		const dstRelayer = Wallet.fromPhrase(dstConfig.relayer, dstProvider)
		const dstDeliver = ETHDeliver__factory.connect(dstConfig.deliver, dstRelayer)
		const dstPoolBalance = await dstProvider.getBalance(dstDeliver.target)
		if (received >= dstPoolBalance) {
			throw Errors.BAD_REQUEST.with(`dst received ${received} is greater than dst pool balance ${dstPoolBalance}`)
		}
		const gas = await dstDeliver.finalize.estimateGas(txBody)
		const feeData = await dstProvider.getFeeData()
		const gasLimit = gas * BigInt(dstConfig.finalizeTxGasLimitCap) / 100n
		const gasPrice = feeData.gasPrice! * BigInt(dstConfig.finalizeTxGasPriceCap) / 100n
		const estimateFinalizeTxFee = gasLimit * gasPrice
		if (received - depositFee <= estimateFinalizeTxFee) {
			throw Errors.BAD_REQUEST.with(`estimate finalized ${received - depositFee} is less than estimateFinalizeTxFee ${estimateFinalizeTxFee}`)
		}
		const estimateAmt = received - depositFee - estimateFinalizeTxFee
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