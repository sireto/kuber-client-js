Kuber-Client [Browser]
=====================
Use kuber from browser


### Add as a Dependency

```
$ npm install kuber-client
```



### Example Usage

```js
    import {Kuber,listProviders,signAdSubmit} from "kuber-client"
    async function donate(amount){
        const kuber=new Kuber('https://mainnet.kuberide.com')
        const providers = listProviders()
        if(!providers){
            alert('Wallet Not detected. Install Compatible cip-30 compatible wallet')
        }
        let provider=providers[0];
        console.info("Using wallet Provider",provider.name)

        return kuber.buildWithProvider({
            outputs:[
                {
                    address: "addr1v9f4au6ux739r5kttd4208qerumrsh6mrenvcvq82e0rpwca3u2u6",
                    value: amount
                }
            ]
        }).then(tx=>{
            signAndSubmit(provider,tx)
        }).catch(e=>{
            alert((e && e.message) || e)
        })
    }
    Promise.resolve(donate(5000000)) // or donate("5A")
```

**JSON API refreence** : []()