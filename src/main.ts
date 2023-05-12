import SafeSDKPlugin from "./SafeSDKPlugin";

declare global {
	interface Window {
		SafeSDKPlugin: any;
    runDemo: () => void;
	}
}

window.SafeSDKPlugin = SafeSDKPlugin;

async function runDemo() {
  const web3Auth = 'BIV9bqt-hKSorZvc6Nmng0XlHSc83Dt3kN_-aAH3_CAZPgK3BGTDRJCY7vW--1r9FyMEJh1yAuukv0eOlZk7NMk';
  const rpc = `https://rpc.ankr.com/eth_goerli`;

  const safe = new SafeSDKPlugin();

  await safe.init(web3Auth, '0x5', rpc);

  await safe.signIn();

  await safe.createSafe();
}

window.runDemo = runDemo;
