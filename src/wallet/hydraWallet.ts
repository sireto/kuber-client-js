import { CIP30Wallet } from "libcardano/libcardano-wallet/cip30/wallet";
import { KuberHydraService } from "../service/kuberHydraService";

export class HydraWallet extends CIP30Wallet {
  constructor(hydraService: KuberHydraService) {
    super(hydraService, hydraService);
  }
}
