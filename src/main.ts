import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { SafeAuthKit, Web3AuthModalPack } from '@safe-global/auth-kit';
import { Web3AuthOptions } from '@web3auth/modal';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { CHAIN_NAMESPACES, WALLET_ADAPTERS } from "@web3auth/base";

declare global {
  interface Window { ThirdwebSDK: any; safeAuthKit: any; }
}

async function main() {
  // https://dashboard.web3auth.io/
  const WEB3_AUTH_CLIENT_ID="BIV9bqt-hKSorZvc6Nmng0XlHSc83Dt3kN_-aAH3_CAZPgK3BGTDRJCY7vW--1r9FyMEJh1yAuukv0eOlZk7NMk"

  // https://web3auth.io/docs/sdk/web/modal/initialize#arguments
  const options: Web3AuthOptions = {
    clientId: WEB3_AUTH_CLIENT_ID,
    web3AuthNetwork: 'testnet',
    chainConfig: {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: '0x5',
      // https://chainlist.org/
      rpcTarget: `https://rpc.ankr.com/eth_goerli`
    },
      uiConfig: {
        theme: 'dark',
        loginMethodsOrder: ['google', 'facebook']
      }
  }

  // https://web3auth.io/docs/sdk/web/modal/initialize#configuring-adapters
  const modalConfig = {
    [WALLET_ADAPTERS.TORUS_EVM]: {
      label: 'torus',
      showOnModal: false
    },
    [WALLET_ADAPTERS.METAMASK]: {
      label: 'metamask',
      showOnDesktop: true,
      showOnMobile: false
    }
  }

  // https://web3auth.io/docs/sdk/web/modal/whitelabel#whitelabeling-while-modal-initialization
  const openloginAdapter = new OpenloginAdapter({
    loginSettings: {
      mfaLevel: 'mandatory'
    },
    adapterSettings: {
      uxMode: 'popup',
      whiteLabel: {
        name: 'Safe'
      }
    }
  })

  const pack = new Web3AuthModalPack(options, [openloginAdapter], modalConfig)

  console.log('pack', pack);

  const safeAuthKit = await SafeAuthKit.init(pack, {
    txServiceUrl: 'https://safe-transaction-goerli.safe.global'
  })

  console.log('safeAuthKit', safeAuthKit);

  window.ThirdwebSDK = ThirdwebSDK;
  window.safeAuthKit = safeAuthKit;
}

main()
