import { ethers } from 'ethers';
import {
	SafeMultisigTransactionResponse,
	SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';
import { SafeAuthKit, Web3AuthModalPack } from '@safe-global/auth-kit';
import { Web3AuthOptions } from '@web3auth/modal';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { CHAIN_NAMESPACES, WALLET_ADAPTERS, log } from '@web3auth/base';
import Safe, { EthersAdapter, SafeFactory } from '@safe-global/protocol-kit';
import SafeApiKit, {
	AllTransactionsListResponse,
	OwnerResponse,
} from '@safe-global/api-kit';

interface Chains {
  [key: string]: {
    chainId: string;
    rpcUrl: string;
    safeTxServiceUrl: string;
  };
}

enum LoginMethods {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  TWITTER = 'twitter',
  REDDIT = 'reddit',
  DISCORD = 'discord',
  TWITCH = 'twitch',
  APPLE = 'apple',
  LINE = 'line',
  GITHUB = 'github',
  KAKAO = 'kakao',
  LINKEDIN = 'linkedin',
  WEIBO = 'weibo',
  WECHAT = 'wechat',
  EMAIL_PASSWORDLESS = 'email_passwordless',
}

enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}


class SafeSDKPlugin {
	signer: any;
	safeAuthKit: any;
	user: any;
	connectedSafeAddress: any;
  chains: Chains = {
    '1': {
      chainId: '0x1',
      rpcUrl: 'https://mainnet.infura.io/v3/3d8a7f0e7d9a4b0e8b2b2b3f0b0b0b0b',
      safeTxServiceUrl: 'https://safe-transaction.mainnet.gnosis.io',
    },
    '4': {
      chainId: '0x4',
      rpcUrl: 'https://rinkeby.infura.io/v3/3d8a7f0e7d9a4b0e8b2b2b3f0b0b0b0b',
      safeTxServiceUrl: 'https://safe-transaction.rinkeby.gnosis.io',
    },
    '5': {
      chainId: '0x5',
      rpcUrl: 'https://goerli.infura.io/v3/3d8a7f0e7d9a4b0e8b2b2b3f0b0b0b0b',
      safeTxServiceUrl: 'https://safe-transaction.goerli.gnosis.io',
    },
  };
  selectedChainId: string;

	async init(
		web3AuthClientId: string,
		chainId: string,
    web3AuthNetwork: any = 'testnet',
    loginMethods: LoginMethods[] = [
      LoginMethods.GOOGLE,
      LoginMethods.TWITTER,
      LoginMethods.FACEBOOK,
    ],
    theme: Theme = Theme.DARK,
	) {
    if (!this.chains[chainId]) {
      throw new Error('Network not supported');
    }

    if (loginMethods.length === 0) {
      throw new Error('At least one login method must be provided');
    }

    loginMethods.forEach((loginMethod) => {
      if (!Object.values(LoginMethods).includes(loginMethod)) {
        throw new Error(`Login method ${loginMethod} is not supported`);
      }
    });

		// https://web3auth.io/docs/sdk/web/modal/initialize#arguments
		const options: Web3AuthOptions = {
			clientId: web3AuthClientId,
			web3AuthNetwork: web3AuthNetwork,
			chainConfig: {
				chainNamespace: CHAIN_NAMESPACES.EIP155,
				chainId: this.chains[chainId].chainId,
				// https://chainlist.org/
				rpcTarget: this.chains[chainId].rpcUrl,
			},
			uiConfig: {
				theme: theme,
				loginMethodsOrder: loginMethods,
			},
		};

		// https://web3auth.io/docs/sdk/web/modal/initialize#configuring-adapters
		const modalConfig = {
			[WALLET_ADAPTERS.METAMASK]: {
				label: 'metamask',
				showOnDesktop: true,
				showOnMobile: true,
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
			txServiceUrl: this.chains[chainId].safeTxServiceUrl,
		});

    this.selectedChainId = chainId;
	}

	async signIn() {
		const res = await this.safeAuthKit.signIn();
		this.user = res;
		console.log('res', res);
		if (res.safes.length > 0) {
			this.connectedSafeAddress = res.safes[0];
		}
		return res;
	}

	async signOut() {
		await this.safeAuthKit.signOut();
		this.user = null;
	}

	getConnectedSafeAddress() {
		return this.connectedSafeAddress;
	}

	async setConnectedSafeAddress(safeAddress: string) {
		const safes = await this.getAllSafes();
		if (safes.indexOf(safeAddress) !== -1) {
			this.connectedSafeAddress = safeAddress;
		} else {
			console.log('Safe wallet address not found');
		}
	}

	/**
	 * We can create a transaction object by calling the method createTransaction in our Safe instance.
	 * @param destination
	 * @param amount
	 * @returns
	 */
	async createTransaction(destination: string, amount: string) {
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);
		const safeAddress = this.connectedSafeAddress;

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

		const txHash = await safeSDK.getTransactionHash(res);
		return { res, txHash };
	}

	/**
	 * Once we have the Safe transaction object we can
	 * share it with the other owners of the Safe so they can sign it.
	 * To send the transaction to the Safe Transaction Service we need to
	 * call the method proposeTransaction from the Safe API Kit instance
	 *
	 * @param safeTransaction
	 * @param safeTxHash
	 */
	async proposeTransaction(safeTxHash: string, safeTransaction: any) {
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);
		const safeAddress = this.connectedSafeAddress;

		const signer = provider.getSigner();
		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});
		const safeSDK = await Safe.create({
			ethAdapter,
			safeAddress,
		});
		const txServiceUrl = this.chains[this.selectedChainId].safeTxServiceUrl;
		const safeService = new SafeApiKit({
			txServiceUrl,
			ethAdapter: ethAdapter,
		});
		// Sign transaction to verify that the transaction is coming from owner 1
		const senderSignature = await safeSDK.signTransactionHash(safeTxHash);

		await safeService.proposeTransaction({
			safeAddress,
			safeTransactionData: safeTransaction.data,
			safeTxHash,
			senderAddress: this.user.eoa,
			senderSignature: senderSignature.data,
		});
	}

	/**
	 * Anyone can execute the Safe transaction once it has the
	 * required number of signatures. In this example, owner 1 will
	 * execute the transaction and pay for the gas fees.
	 */
	async executeTransaction(safeTxHash: string) {
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

		const safeAddress = this.connectedSafeAddress;

		const signer = provider.getSigner();
		// Sign transaction to verify that the transaction is coming from owner 1
		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});

		const safeService = new SafeApiKit({
			txServiceUrl: this.chains[this.selectedChainId].safeTxServiceUrl,
			ethAdapter: ethAdapter,
		});

		const safeSDK = await Safe.create({
			ethAdapter,
			safeAddress,
		});

		const safeTransaction = await safeService.getTransaction(safeTxHash);

		const isValidTx = await safeSDK.isValidTransaction(safeTransaction);

		if (!isValidTx) {
      throw new Error('Transaction is not valid');
		}
    const executeTxResponse = await safeSDK.executeTransaction(
      safeTransaction
    );

    const receipt =
      executeTxResponse.transactionResponse &&
      (await executeTxResponse.transactionResponse.wait());

    return receipt;
	}

	/**
	 * txHash The owners of the Safe can now sign the transaction obtained
	 *  from the Safe Transaction Service by calling the method signTransactionHash
	 * from the Protocol Kit to generate the signature and by calling the method confirmTransaction
	 * from the Safe API Kit to add the signature to the service.
	 */
	async confirmTransaction(txHash: string) {
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

		const safeAddress = this.connectedSafeAddress;

		const signer = provider.getSigner();
		// Sign transaction to verify that the transaction is coming from owner 1
		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});

		const safeService = new SafeApiKit({
			txServiceUrl: this.chains[this.selectedChainId].safeTxServiceUrl,
			ethAdapter: ethAdapter,
		});

		const safeSDK = await Safe.create({
			ethAdapter,
			safeAddress,
		});
		let signature = await safeSDK.signTransactionHash(txHash);
		await safeService.confirmTransaction(txHash, signature.data);
	}

	/**
	 *
	 * @returns
	 */
	async getPendingTransactions() {
		const safeAddress = this.connectedSafeAddress;
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);
		const signer = provider.getSigner();
		// Sign transaction to verify that the transaction is coming from owner 1
		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});

		const safeService = new SafeApiKit({
			txServiceUrl: this.chains[this.selectedChainId].safeTxServiceUrl,
			ethAdapter: ethAdapter,
		});

		const pendingTransactions = await safeService.getPendingTransactions(
			safeAddress
		);

		return pendingTransactions;
	}

	async createSafe(owners: string[], threshold: number) {
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

		const owner = provider.getSigner();

		if (!owner) {
			throw new Error('You are not connected to a wallet');
		}

		if (threshold > owners.length + 1 || threshold <= 0) {
			throw new Error('Threshold is not valid');
		}

		const address = await owner.getAddress();

		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: owner,
		});

		const safeFactory = await SafeFactory.create({ ethAdapter: ethAdapter });

		const safeAddress = await safeFactory.deploySafe({
			safeAccountConfig: {
				owners: [...owners, address],
				threshold,
			},
		});

		return safeAddress;
	}

	async getPrivateKey() {
		const authKitProvider = this.safeAuthKit.getProvider();
		const privateKey = await authKitProvider.request({
			method: 'private_key',
		});

    return privateKey;
	}

	async getAllSafes() {
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

		const owner = provider.getSigner();

		if (!owner) {
			throw new Error('You are not connected to a wallet');
		}

		const address = await owner.getAddress();

		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: owner,
		});

		const safeService = new SafeApiKit({
			txServiceUrl: this.chains[this.selectedChainId].safeTxServiceUrl,
			ethAdapter,
		});

		const safes: OwnerResponse = await safeService.getSafesByOwner(address);

    console.log('safes', safes);

		return safes.safes;
	}

	async getAllTransactions() {
		const safeAddress = this.connectedSafeAddress;
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

		const owner = provider.getSigner();

		if (!owner) {
			throw new Error('You are not connected to a wallet');
		}

		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: owner,
		});

		const safeService = new SafeApiKit({
			txServiceUrl: 'https://safe-transaction-goerli.safe.global',
			ethAdapter,
		});

		const allTxs: AllTransactionsListResponse =
			await safeService.getAllTransactions(safeAddress);

    console.log('allTxs', allTxs);

		return allTxs;
	}

	async getTransaction(safeTxHash: any) {
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

		const owner = provider.getSigner();

		if (!owner) {
			throw new Error('You are not connected to a wallet');
		}

		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: owner,
		});

		const safeService = new SafeApiKit({
			txServiceUrl: this.chains[this.selectedChainId].safeTxServiceUrl,
			ethAdapter,
		});

		const tx: SafeMultisigTransactionResponse =
			await safeService.getTransaction(safeTxHash);

		console.log('tx', tx);

		return tx;
	}
}

export default SafeSDKPlugin;
