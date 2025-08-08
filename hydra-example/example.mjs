import { loadCrypto, Ed25519Key } from "libcardano";
import { ShelleyWallet,Cip30ShelleyWallet } from "libcardano-wallet";
import { readFileSync } from "fs";
import { KuberHydraApiProvider } from "kuber-client";

async function main(){
  await loadCrypto();

  const hydra = new KuberHydraApiProvider("http://localhost:8081")
  const testWalletSigningKey = await Ed25519Key.fromCardanoCliJson(
    JSON.parse(readFileSync("example.sk",'utf-8'))
  );

  const shelleyWallet = new ShelleyWallet(testWalletSigningKey);
  const cip30Wallet = new Cip30ShelleyWallet(hydra,hydra,shelleyWallet,1)

  const head = await hydra.queryHeadState()
  if(head.state != "Open"){
    throw new Error("Head is" + head.state+ "Expected Open")
  }
  console.log("Hydra Balance", await cip30Wallet.getBalance());
  
  hydra.buildWithWallet(cip30Wallet,{
    outputs:{
      address: shelleyWallet.addressBech32,
      value: "2A"
    }
  })
}
await main()