import { log } from '@web3auth/base';
import SafeSDKPlugin from './SafeSDKPlugin';

declare global {
	interface Window {
		SafeSDKPlugin: any;
		runDemo: () => void;
		SafeDEMOSDKPlugin: any;
	}
}

window.SafeSDKPlugin = SafeSDKPlugin;

async function runDemo() {
	const web3Auth =
		'BIV9bqt-hKSorZvc6Nmng0XlHSc83Dt3kN_-aAH3_CAZPgK3BGTDRJCY7vW--1r9FyMEJh1yAuukv0eOlZk7NMk';
	const rpc = `https://rpc.ankr.com/eth_goerli`;

	const safe = new SafeSDKPlugin();

	await safe.init(web3Auth, '0x5', rpc);

	await safe.signIn();

	window.SafeDEMOSDKPlugin = safe;

	await safe.setConnectedSafeAddress(
		'0x8e5a8d1027bE5Ab455fDE0a56753756604B8A41a'
	);
	// await safe.createSafe();
	// const resTx = await safe.createTransaction(
	// 	'0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
	// 	'0.005'
	// );

	// console.log(resTx);

	// await safe.proposeTransaction(resTx.txHash, resTx.res);

	// const t = await safe.getPendingTransactions();
	// console.log(t);

	// const res = await safe.executeTransaction(resTx.txHash);
	// console.log(res);
}

window.runDemo = runDemo;
