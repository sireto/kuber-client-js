Kuber-Client
=====================
Library for interacting with cardano wallet and blockchain via `kuber-server`. 

Kuber-Client Provides Unified  interfce that works on web browsers, Node.js applications, and even with `kuber-hydra` server.

With kuber-client, you can:
- Query utxos, prototol parameters, time-slot information
- Make Ada payments
- Mint/burn Cardano native tokens and NFTs
- Interact with Plutus contracts
- Add metadata to transactions
- Participate in cardano governance
- Interact with Hydra side-chain


### Add as a Dependency

```
$ npm install kuber-client
```

### Run API Services

`kuber-client` requires corresponding API services to connect to the Cardano network and Hydra heads.

*   **Kuber API Service:** For standard Cardano transactions, an instance of the [Kuber API service](https://github.com/dQuadrant/kuber) must be running. This service exposes the necessary endpoints for building and submitting transactions to the blockchain.

*   **KuberHydra API Service:** For Hydra-related operations, an instance of the [KuberHydra API service](https://github.com/dQuadrant/kuber/tree/master/kuber-hydra) is required. It provides hydra as well as Layer1 APIs.

## Kuber Transaction Builder reference
[Docs : kuberide.com](https://kuberide.com/kuber/docs/tx-builder-reference)


## Examples

1. [Client Browser Example](#client-browser-example)
2. [Backend CLI Example](#backend-cli-example)
3. [Hydra Example](#hydra-example)

### 1. [Client] Browser Example

This example demonstrates how to use `kuber-client` in a browser environment with a CIP-30 compliant wallet like Nami or Eternl.

```js
import {KuberApiProvider} from "kuber-client";
import {BrowserCardanoExtension} from "kuber-client/browser";

async function donate(amount) {
    const kuber = new KuberApiProvider('http://localhost:8081',"your-api-key");
    const providers = BrowserCardanoExtension.list();

    if (!providers) {
        alert('Wallet Not detected. Install a CIP-30 compatible wallet.');
        return;
    }

    let provider = providers[0];
    const wallet = await provider.enable();
    

    console.info("Using Browser Wallet", {
        name: provider.name,
        balance: (await wallet.getBalance()).multiAssetsUtf8()
    });

    return kuber.buildAndSignWithWallet(wallet,{
        outputs: [
            {
                address: "addr1v9f4au6ux739r5kttd4208qerumrsh6mrenvcvq82e0rpwca3u2u6",
                value: amount
            }
        ]
    }).then(tx => {
        return wallet.submitTx(tx.updatedTxBytes.toString("hex"));
    }).catch(e => {
        alert((e && e.message) || e);
    });
}

Promise.resolve(donate(5000000)); // or donate("5A")
Promise.resolve(donate(5000000)); // or donate("5A")
```

### 2. [Backend] CLI Example

This example shows how to use `kuber-client` in a Node.js environment to build a transaction.

```js
const { KuberApiProvider } = require("kuber-client");
const { loadCrypto, Ed25519Key } = require("libcardano");
const { ShelleyWallet, Cip30ShelleyWallet } = require("libcardano-wallet");
const { readFileSync } = require("fs");
const { Network } = require("libcardano-wallet/cip30/types");

async function main() {
    await loadCrypto();

    const kuber = new KuberApiProvider('http://localhost:8081',process.env.KUBER_API_KEY);
    const testWalletSigningKey = await Ed25519Key.fromCardanoCliJson(
        JSON.parse(readFileSync("payment.skey", 'utf-8'))
    );

    const shelleyWallet = new ShelleyWallet(testWalletSigningKey);
    const cip30Wallet = new Cip30ShelleyWallet(kuber, kuber, shelleyWallet, Network.Testnet);

    const tx = await kuber.buildWithWallet(cip30Wallet,{
        outputs: [{
            address: "addr1v9f4au6ux739r5kttd4208qerumrsh6mrenvcvq82e0rpwca3u2u6",
            value: "2A"
        }],
    });

    const signedTx = await cip30Wallet.signTx(tx.cborHex);
    await cip30Wallet.submitTx(signedTx.updatedTxBytes.toString("hex"));
    console.log("Transaction submitted:", signedTx);
}

Promise.resolve(main());

Promise.resolve(main());
```

### 3. Hydra Example

#### See full docs [here](https://dquadrant.github.io/kuber/hydra_docusaurus/docs/hydra-js-client/getting-started/)

This example demonstrates how to use `kuber-client` to interact with a Hydra head.

```js
const { KuberHydraApiProvider } = require("kuber-client");
const { loadCrypto, Ed25519Key } = require("libcardano");
const { ShelleyWallet, Cip30ShelleyWallet } = require("libcardano-wallet");
const { readFileSync } = require("fs");

async function main() {
    await loadCrypto();

    const hydra = new KuberHydraApiProvider("http://localhost:8081",process.env.KUBER_API_KEY);
    const testWalletSigningKey = await Ed25519Key.fromCardanoCliJson(
        JSON.parse(readFileSync("example.sk", 'utf-8'))
    );

    const shelleyWallet = new ShelleyWallet(testWalletSigningKey);
    const cip30Wallet = new Cip30ShelleyWallet(hydra, hydra, shelleyWallet, 1);

    const head = await hydra.queryHeadState();
    if (head.state !== "Open") {
        throw new Error("Head is " + head.state + ". Expected Open");
    }

    console.log("Hydra Balance", await cip30Wallet.getBalance());

    await hydra.buildWithWallet(cip30Wallet, {
        outputs: [{
            address: await cip30Wallet.getChangeAddress(),
            value: "2A"
        }],
        changeAddress: await cip30Wallet.getChangeAddress()
    });
    const signedTx = await cip30Wallet.signTx(tx.cborHex);
    await cip30Wallet.submitTx(signedTx.updatedTxBytes.toString("hex"));
    console.log("Transaction submitted:", signedTx);
}

Promise.resolve(main());
```


