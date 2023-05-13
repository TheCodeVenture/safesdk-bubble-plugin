import { ethers } from 'ethers';
import { SafeMultisigTransactionResponse, SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import { SafeAuthKit, Web3AuthModalPack } from '@safe-global/auth-kit';
import { Web3AuthOptions } from '@web3auth/modal';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { CHAIN_NAMESPACES, WALLET_ADAPTERS, log } from '@web3auth/base';
import Safe, { EthersAdapter, SafeFactory } from '@safe-global/protocol-kit';
import SafeApiKit, { AllTransactionsListResponse, OwnerResponse, SafeInfoResponse, SafeMultisigTransactionListResponse } from '@safe-global/api-kit';

class SafeSDKPlugin {
	signer: any;
	safeAuthKit: any;
	user: any;

	async init(
		web3AuthClientId: string,
		chainId: string,
		rpcUrl: string
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
		this.user = res;
		console.log('res', res);
		return res;
	}

	async signOut() {
		await this.safeAuthKit.signOut();
		this.user = null;
	}

	/**
	 * We can create a transaction object by calling the method createTransaction in our Safe instance.
	 * @param destination
	 * @param amount
	 * @returns
	 */
	async createTransaction(destination: string, amount: string) {
		// Any address can be used. In this example you will use vitalik.eth
		// const destination = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);
		const safeAddress = this.user.safes[1];

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
		const safeAddress = this.user.safes[1];

		const signer = provider.getSigner();
		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});
		const safeSDK = await Safe.create({
			ethAdapter,
			safeAddress,
		});
		const txServiceUrl = 'https://safe-transaction-goerli.safe.global';
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

		const safeAddress = this.user.safes[0];

		const signer = provider.getSigner();
		// Sign transaction to verify that the transaction is coming from owner 1
		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});

		const txServiceUrl = 'https://safe-transaction-goerli.safe.global';
		const safeService = new SafeApiKit({
			txServiceUrl,
			ethAdapter: ethAdapter,
		});

		const safeSDK = await Safe.create({
			ethAdapter,
			safeAddress,
		});

		const safeTransaction = await safeService.getTransaction(safeTxHash);
		const isValidTx = await safeSDK.isValidTransaction(safeTransaction);
		if (isValidTx) {
			const executeTxResponse = await safeSDK.executeTransaction(
				safeTransaction
			);
			const receipt =
				executeTxResponse.transactionResponse &&
				(await executeTxResponse.transactionResponse.wait());
			return receipt;
		}

		return 'There is signatures missing';
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

		const safeAddress = this.user.safes[0];

		const signer = provider.getSigner();
		// Sign transaction to verify that the transaction is coming from owner 1
		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});

		const txServiceUrl = 'https://safe-transaction-goerli.safe.global';
		const safeService = new SafeApiKit({
			txServiceUrl,
			ethAdapter: ethAdapter,
		});

		const safeSDK = await Safe.create({
			ethAdapter,
			safeAddress,
		});
		let signature = await safeSDK.signTransactionHash(txHash);
		await safeService.confirmTransaction(txHash, signature.data);
	}

	rejectTransaction(txHash: string) {}

	/**
	 *
	 * @returns
	 */
	async getPendingTransactions(safeAddress: any) {
		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);
		const signer = provider.getSigner();
		// Sign transaction to verify that the transaction is coming from owner 1
		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: signer || provider,
		});

		const txServiceUrl = 'https://safe-transaction-goerli.safe.global';
		const safeService = new SafeApiKit({
			txServiceUrl,
			ethAdapter: ethAdapter,
		});

		// TODO: this should getAllSafes in case this.user is not fetched yet
		const address = this.user.safes.find((address: any) => address === safeAddress);
		if(!address) {
			throw new Error('This wallet does not exist')
		}

		const pendingTransactions = await safeService.getPendingTransactions(
			address
		);
		console.log(pendingTransactions);
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

		if (threshold > (owners.length + 1) || threshold <= 0) {
			throw new Error('Threshold is not valid')
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

		console.log('safeAddress', safeAddress);
		return safeAddress;
	}

	async getPrivateKey() {
		const authKitProvider = this.safeAuthKit.getProvider();
		const privateKey = await authKitProvider.request({
			method: 'private_key',
		});
		console.log('privateKey', privateKey);
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
			txServiceUrl: 'https://safe-transaction-goerli.safe.global',
			ethAdapter
		  })

		const safes: OwnerResponse = await safeService.getSafesByOwner(address)
		console.log(safes);

		return safes;
	}

	async getAllTransactions(safeAddress: any) {

		const provider = new ethers.providers.Web3Provider(
			this.safeAuthKit.getProvider()
		);

		const owner = provider.getSigner();

		if (!owner) {
			throw new Error('You are not connected to a wallet');
		}

		// TODO: this should getAllSafes in case this.user is not fetched yet
		const address = this.user.safes.find((address: any) => address === safeAddress);
		if(!address) {
			throw new Error('This wallet does not exist')
		}

		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: owner,
		});
		
		const safeService = new SafeApiKit({
			txServiceUrl: 'https://safe-transaction-goerli.safe.global',
			ethAdapter
		  })

		const allTxs: AllTransactionsListResponse = await safeService.getAllTransactions(
			address
		  )

		console.log('allTxs', allTxs);
		return allTxs;
	}

	async getTransaction (safeTxHash: any) {

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
			ethAdapter
		})

		const tx: SafeMultisigTransactionResponse = await safeService.getTransaction(safeTxHash)

		console.log('tx', tx);
		return tx;
		
	}
}

export default SafeSDKPlugin;
