import * as fs from 'fs';
import * as path from 'path';
import { Ed25519Key, loadCrypto } from 'libcardano';
import { ShelleyWallet, Cip30ShelleyWallet } from 'libcardano-wallet';
import { KuberHydraApiProvider } from '../src/service/KuberHydraApiProvider';
import { Value } from 'libcardano';

export class HydraTestParticipant {
  private httpUrl: string;
  private fundKeyFile: string;
  private nodeKeyFile: string;
  private fundKey: Ed25519Key | null = null;
  private nodeKey: Ed25519Key | null = null;
  private kuberHydraApiProvider: KuberHydraApiProvider;
  private cip30Wallet: Cip30ShelleyWallet | null = null;
  private walletAddress: string = '';

  constructor(httpUrl: string, fundKeyFile: string, nodeKeyFile: string) {
    this.httpUrl = httpUrl;
    this.fundKeyFile = fundKeyFile;
    this.nodeKeyFile = nodeKeyFile;
    this.kuberHydraApiProvider = new KuberHydraApiProvider(this.httpUrl);
  }

  private async loadKeys(): Promise<void> {
    if (!this.fundKey) {
      const fundKeyContent = fs.readFileSync(this.fundKeyFile, 'utf-8');
      this.fundKey = await Ed25519Key.fromCardanoCliJson(JSON.parse(fundKeyContent));
    }
    if (!this.nodeKey) {
      const nodeKeyContent = fs.readFileSync(this.nodeKeyFile, 'utf-8');
      this.nodeKey = await Ed25519Key.fromCardanoCliJson(JSON.parse(nodeKeyContent));
    }
  }

  public async getFundKey(): Promise<Ed25519Key> {
    await loadCrypto();
    await this.loadKeys();
    if (!this.fundKey) {
      throw new Error('Fund key not loaded.');
    }
    return this.fundKey;
  }

  public async getNodeKey(): Promise<Ed25519Key> {
    await loadCrypto();
    await this.loadKeys();
    if (!this.nodeKey) {
      throw new Error('Node key not loaded.');
    }
    return this.nodeKey;
  }

  public getKuberHydraUrl(): string {
    return this.httpUrl;
  }

  public async getCip30Wallet(): Promise<Cip30ShelleyWallet> {
    if (!this.cip30Wallet) {
      await loadCrypto();
      const shelleyWallet = new ShelleyWallet(await this.getFundKey());
      this.cip30Wallet = new Cip30ShelleyWallet(this.kuberHydraApiProvider, this.kuberHydraApiProvider, shelleyWallet, 0);
      this.walletAddress = (await this.cip30Wallet.getChangeAddress()).toBech32();
    }
    return this.cip30Wallet;
  }

  public async hasFunds(minAmount: bigint = 1000000n): Promise<boolean> { // Default minAmount to 1 ADA
    try {
      const _wallet = await this.getCip30Wallet();
      const balance = await _wallet.getBalance()
      return balance.greaterThan(new Value(minAmount));
    } catch (error) {
      console.error(`Error checking funds for participant ${this.httpUrl}:`, error);
      return false;
    }
  }

  public getKuberHydraApiProvider(): KuberHydraApiProvider {
    return this.kuberHydraApiProvider;
  }
}
