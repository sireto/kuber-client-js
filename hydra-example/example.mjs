import { loadCrypto, Ed25519Key } from "libcardano";
import { ShelleyWallet,Cip30ShelleyWallet } from "libcardano-wallet";
import { readFileSync } from "fs";
import { KuberHydraApiProvider } from "kuber-client";

async function main(){
  await loadCrypto();

  const kuberHydra = new KuberHydraApiProvider("http://localhost:8082")
  const testWalletSigningKey = await Ed25519Key.fromCardanoCliJson(
    JSON.parse(readFileSync("example.sk",'utf-8'))
  );

  const shelleyWallet = new ShelleyWallet(testWalletSigningKey);
  const cip30Wallet = new Cip30ShelleyWallet(kuberHydra,kuberHydra,shelleyWallet,1)
  
  kuberHydra.buildWithWallet(cip30Wallet,{
    outputs:{
      address: shelleyWallet.addressBech32,
      value: "2A"
    }
  })
}
await main()