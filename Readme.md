Kuber-Client [Browser]
=====================
Use kuber with cardano cip30 wallets for composing and submitting transactions

With the power of kuber you can do following using browser wallets
 - make Ada payments
 - mint/burn cardano native tokens and nft
 - pay and redeem from plutus contracts
 - add metadata to transaction

### Add as a Dependency

```
$ npm install kuber-client
```

### Example Usage

```js
import {Kuber,CIP30Wallet} from "kuber-client"
async function donate(amount){
    const kuber=new Kuber('https://mainnet.kuberide.com')
    const providers = CIP30Wallet.listProviders();

    if(!providers){
        alert('Wallet Not detected. Install Compatible cip-30 compatible wallet')
        return
    }
    let provider=providers[0];
    const wallet=provider.enable()
    console.info("Using Browser Wallet",{
        name: wallet.name
        balance: (await wallet.calculateBalance()).multiAssetsUtf8()
        })

    return kuber.buildWithProvider(wallet,{
        outputs:[
            {
                address: "addr1v9f4au6ux739r5kttd4208qerumrsh6mrenvcvq82e0rpwca3u2u6",
                value: amount
            }
        ]
    }).then(tx=>{
        wallet.signAndSubmit(tx)
    }).catch(e=>{
        alert((e && e.message) || e)
    })
}
Promise.resolve(donate(5000000)) // or donate("5A")
```

## Kuber Api Reference
[dquadrant/kuber](https://github.com/dQuadrant/kuber/blob/master/docs/json-api-reference.md)