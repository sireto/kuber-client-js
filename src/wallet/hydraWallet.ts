import { CIP30Wallet } from "libcardano-wallet//cip30/wallet";
import { KuberHydraService } from "../service/kuberHydraService";
import { ShelleyWallet } from "libcardano/cardano/primitives/address";

export class HydraWallet extends CIP30Wallet {
  constructor(
    hydraService: KuberHydraService,
    shelleyWallet: ShelleyWallet,
    network: 0 | 1
  ) {
    super(hydraService, hydraService, shelleyWallet, network);
  }
}
