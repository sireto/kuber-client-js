Kuber-Client
=====================
Library for querying, building and submitting transactions on cardano blockchain via `kuber-server`. Provides Unified  interface that works on web browsers, Node.js applications, and even with `kuber-hydra` server.

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

### [Client] Browser Example

This example demonstrates how to use `kuber-client` in a browser environment with a CIP-30 compliant wallet like Nami or Eternl.

```js
import {Kuber} from "kuber-client";
import {BrowserCardanoExtension, Cip30ShelleyWallet} from "kuber-client/browser";

async function donate(amount) {
    const kuber = new Kuber('http://localhost:8081');
    const providers = BrowserCardanoExtension.list();

    if (!providers) {
        alert('Wallet Not detected. Install a CIP-30 compatible wallet.');
        return;
    }

    let provider = providers[0];
    const cip30WalletProvider = await provider.enable();
    const wallet = new Cip30ShelleyWallet(kuber, kuber, cip30WalletProvider);

    console.info("Using Browser Wallet", {
        name: wallet.name,
        balance: (await wallet.calculateBalance()).multiAssetsUtf8()
    });

    return kuber.build({
        outputs: [
            {
                address: "addr1v9f4au6ux739r5kttd4208qerumrsh6mrenvcvq82e0rpwca3u2u6",
                value: amount
            }
        ],
        changeAddress: await wallet.getChangeAddress()
    }).then(tx => {
        return wallet.signAndSubmit(tx);
    }).catch(e => {
        alert((e && e.message) || e);
    });
}

Promise.resolve(donate(5000000)); // or donate("5A")
```

### [Backend] CLI Example

This example shows how to use `kuber-client` in a Node.js environment to build a transaction.

```js
const { Kuber, KuberApiProvider } = require("kuber-client");
const { loadCrypto, Ed25519Key } = require("libcardano");
const { ShelleyWallet, Cip30ShelleyWallet } = require("libcardano-wallet");
const { readFileSync } = require("fs");

async function main() {
    await loadCrypto();

    const kuber = new KuberApiProvider('http://localhost:8081');
    const testWalletSigningKey = await Ed25519Key.fromCardanoCliJson(
        JSON.parse(readFileSync("payment.skey", 'utf-8'))
    );

    const shelleyWallet = new ShelleyWallet(testWalletSigningKey);
    const cip30Wallet = new Cip30ShelleyWallet(kuber, kuber, shelleyWallet, 1);

    const tx = await kuber.build({
        outputs: [{
            address: "addr1v9f4au6ux739r5kttd4208qerumrsh6mrenvcvq82e0rpwca3u2u6",
            value: "2A"
        }],
        changeAddress: await cip30Wallet.getChangeAddress()
    });

    const signedTx = await cip30Wallet.signAndSubmit(tx);
    console.log("Transaction submitted:", signedTx);
}

Promise.resolve(main());
```

### Hydra Example

This example demonstrates how to use `kuber-client` to interact with a Hydra head.

```js
const { KuberHydraApiProvider } = require("kuber-client");
const { loadCrypto, Ed25519Key } = require("libcardano");
const { ShelleyWallet, Cip30ShelleyWallet } = require("libcardano-wallet");
const { readFileSync } = require("fs");

async function main() {
    await loadCrypto();

    const hydra = new KuberHydraApiProvider("http://localhost:8081");
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
}

Promise.resolve(main());
```


