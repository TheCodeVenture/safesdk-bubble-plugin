import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { ethers } from 'ethers';
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import { SafeAuthKit, Web3AuthModalPack } from '@safe-global/auth-kit';
import { Web3AuthOptions } from '@web3auth/modal';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { CHAIN_NAMESPACES, WALLET_ADAPTERS } from '@web3auth/base';
import Safe, { EthersAdapter } from '@safe-global/protocol-kit';

declare global {
	interface Window {
		ThirdwebSDK: any;
		safeAuthKit: any;
		safeSDKPlugin: any;
	}
}

class SafeSDKPlugin {
	safeAuthKit: any;
	web3_auth_client_id: any;
	chain_id: any;
	chain_rpc_target: any;
	use_torus_evm: any;
	use_metamask: any;
	sign_in_info: any;
	user_info: any;

	constructor() {}

	async init(
		WEB3_AUTH_CLIENT_ID: string,
		chainId: string,
		chain_rpc_target: string,
		use_torus_evm: boolean,
		use_metamask: boolean
	) {
		this.web3_auth_client_id = WEB3_AUTH_CLIENT_ID;
		this.chain_id = chainId;
		this.chain_rpc_target = chain_rpc_target;
		this.use_torus_evm = use_torus_evm;
		this.use_metamask = use_metamask;

		// https://web3auth.io/docs/sdk/web/modal/initialize#arguments
		const options: Web3AuthOptions = {
			clientId: this.web3_auth_client_id,
			web3AuthNetwork: 'testnet',
			chainConfig: {
				chainNamespace: CHAIN_NAMESPACES.EIP155,
				chainId: this.chain_id,
				// https://chainlist.org/
				rpcTarget: this.chain_rpc_target,
			},
			uiConfig: {
				theme: 'dark',
				loginMethodsOrder: ['google', 'facebook'],
			},
		};

		// https://web3auth.io/docs/sdk/web/modal/initialize#configuring-adapters
		const modalConfig = {
			[WALLET_ADAPTERS.TORUS_EVM]: {
				label: 'torus',
				showOnModal: false,
			},
			[WALLET_ADAPTERS.METAMASK]: {
				label: 'metamask',
				showOnDesktop: true,
				showOnMobile: false,
			},
		};

		// https://web3auth.io/docs/sdk/web/modal/whitelabel#whitelabeling-while-modal-initialization
		const openloginAdapter = new OpenloginAdapter({
			loginSettings: {
				mfaLevel: 'mandatory',
			},
			adapterSettings: {
				uxMode: 'popup',
				whiteLabel: {
					name: 'Safe',
				},
			},
		});

		const pack = new Web3AuthModalPack(
			options,
			[openloginAdapter],
			modalConfig
		);

		this.safeAuthKit = await SafeAuthKit.init(pack, {
			txServiceUrl: 'https://safe-transaction-goerli.safe.global',
		});

		window.ThirdwebSDK = ThirdwebSDK;
		window.safeAuthKit = this.safeAuthKit;
	}

	async signIn() {
		this.sign_in_info = await this.safeAuthKit.signIn();
		this.user_info = await this.safeAuthKit.getUserInfo();
	}

	async signOut() {
		await this.safeAuthKit.signOut();
	}

	async createTransaction(
		destination: string,
		amount: string,
		safeAddress: string
	) {
		// Any address can be used. In this example you will use vitalik.eth
		// const destination = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
		const authKitProvider = this.safeAuthKit.getProvider();
		const provider = new ethers.providers.Web3Provider(authKitProvider);
		const signer = provider.getSigner();

		const amountToSend = ethers.utils.parseUnits(amount, 'ether').toString();

		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});

		const safeSDK = await Safe.create({
			ethAdapter,
			safeAddress,
		});

		const safeTransactionData: SafeTransactionDataPartial = {
			to: destination,
			data: '0x',
			value: amountToSend,
		};
		// Create a Safe transaction with the provided parameters
		const res = await safeSDK.createTransaction({
			safeTransactionData,
		});

		return res;
	}

	async createSafe() {}
}

const web3Auth =
	'BIV9bqt-hKSorZvc6Nmng0XlHSc83Dt3kN_-aAH3_CAZPgK3BGTDRJCY7vW--1r9FyMEJh1yAuukv0eOlZk7NMk';
const rpc = `https://rpc.ankr.com/eth_goerli`;

const safe = new SafeSDKPlugin();
safe.init(web3Auth, '0x5', rpc, false, true);
window.safeSDKPlugin = safe;
