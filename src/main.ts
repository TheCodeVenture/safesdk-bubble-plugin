import SafeSDKPlugin from './SafeSDKPlugin';

declare global {
	interface Window {
		SafeSDKPlugin: any;
    // Testing purposes
		runDemo: () => void;
		safeSdkPlugin: any;
	}
}

window.SafeSDKPlugin = SafeSDKPlugin;

async function runDemo() {
	const web3Auth =
		'BIV9bqt-hKSorZvc6Nmng0XlHSc83Dt3kN_-aAH3_CAZPgK3BGTDRJCY7vW--1r9FyMEJh1yAuukv0eOlZk7NMk';

	const safeSdkPlugin = new SafeSDKPlugin({ web3AuthClientId: web3Auth });

	await safeSdkPlugin.initSafeAuthKit();

	await safeSdkPlugin.signIn();

	// await safeSdkPlugin.setConnectedSafeAddress(
	// 	'0x8e5a8d1027bE5Ab455fDE0a56753756604B8A41a'
	// );

	window.safeSdkPlugin = safeSdkPlugin;

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
