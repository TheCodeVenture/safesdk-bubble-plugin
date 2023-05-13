import { ethers } from 'ethers';
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import { SafeAuthKit, Web3AuthModalPack } from '@safe-global/auth-kit';
import { Web3AuthOptions } from '@web3auth/modal';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { CHAIN_NAMESPACES, WALLET_ADAPTERS } from '@web3auth/base';
import Safe, { EthersAdapter, SafeFactory } from '@safe-global/protocol-kit';


class SafeSDKPlugin {
  signer: any;
  safeAuthKit: any;

	async init(
		web3AuthClientId: string,
		chainId: string,
		rpcUrl: string,
		// use_torus_evm: boolean,
		// use_metamask: boolean
	) {
		// https://web3auth.io/docs/sdk/web/modal/initialize#arguments
		const options: Web3AuthOptions = {
			clientId: web3AuthClientId,
			web3AuthNetwork: 'testnet',
			chainConfig: {
				chainNamespace: CHAIN_NAMESPACES.EIP155,
				chainId: chainId,
				// https://chainlist.org/
				rpcTarget: rpcUrl,
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
	}

	async signIn() {
		const res = await this.safeAuthKit.signIn();
    console.log('res', res);
	}

	async signOut() {
		await this.safeAuthKit.signOut();
	}

	async createTransaction(
		destination: string,
		amount: string,
		safeAddress: any
	) {
		// Any address can be used. In this example you will use vitalik.eth
		// const destination = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

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
		await safeSDK.createTransaction({
			safeTransactionData,
		});
	}

	async createSafe() {
    const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

    const owner = provider.getSigner();

    console.log('owner', owner);

    if (!owner) {
      throw new Error('You are not connected to a wallet');
    }

    const address = await owner.getAddress();

    console.log('address', address);

    const ethAdapter = new EthersAdapter({
      ethers,
      signerOrProvider: owner,
    });

    const safeFactory = await SafeFactory.create({ ethAdapter: ethAdapter })

    const safeAddress = await safeFactory.deploySafe({
      safeAccountConfig: {
        owners: [address],
        threshold: 1,
      },
    });

    console.log('safeAddress', safeAddress);
  }

  async getPrivateKey() {
    const authKitProvider = this.safeAuthKit.getProvider();
    const privateKey = await authKitProvider.request({
        method: "private_key"
    });
    console.log('privateKey', privateKey);
  }
}

export default SafeSDKPlugin
