const { Ed25519Key } = require("libcardano");
const { ShelleyWallet,SimpleCip30Wallet } = require("libcardano-wallet");
const { readFileSync } = require("fs");
const { KuberHydraApiProvider } = require("kuber-client");



async function main(){  
  const hydra = new KuberHydraApiProvider("http://localhost:8081")
  const testWalletSigningKey = await Ed25519Key.fromCardanoCliJson(
    JSON.parse(readFileSync("example.sk",'utf-8'))
  );

  const shelleyWallet = new ShelleyWallet(testWalletSigningKey);
  const cip30Wallet = new SimpleCip30Wallet(hydra,hydra,shelleyWallet,0)
  const walletAddress = (await cip30Wallet.getChangeAddress()).toBech32()

  const head = await hydra.queryHeadState()
  if(head.state != "Open"){
    throw new Error("Head is" + head.state+ "Expected Open")
  }
  
  console.log("Hydra Balance", await cip30Wallet.getBalance());

  await hydra.buildWithWallet(cip30Wallet,{
    outputs:[{
      "address": shelleyWallet.addressBech32(0) ,
      value: "2A"
    }],
    changeAddress: shelleyWallet.addressBech32(0)
  })

  
}


Promise.resolve(main())
