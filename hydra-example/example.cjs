const { loadCrypto, Ed25519Key } = require("libcardano");
const { ShelleyWallet,Cip30ShelleyWallet } = require("libcardano-wallet");
const { readFileSync } = require("fs");
const { KuberHydraApiProvider } = require("kuber-client");



async function main(){
  await loadCrypto();
  
  const hydra = new KuberHydraApiProvider("http://172.31.6.1:8081")
  const testWalletSigningKey = await Ed25519Key.fromCardanoCliJson(
    JSON.parse(readFileSync("example.sk",'utf-8'))
  );

  const shelleyWallet = new ShelleyWallet(testWalletSigningKey);
  const cip30Wallet = new Cip30ShelleyWallet(hydra,hydra,shelleyWallet,0)
  const walletAddress = (await cip30Wallet.getChangeAddress()).toBech32()

  console.log("Head state",await hydra.queryHeadState())
  await hydra.close(true)
  
  await hydra.buildWithWallet(cip30Wallet,{
    outputs:[{
      "address": shelleyWallet.addressBech32(0) ,
      value: "2A"
    }],
    changeAddress: shelleyWallet.addressBech32(0)
  })

  
}


Promise.resolve(main())
