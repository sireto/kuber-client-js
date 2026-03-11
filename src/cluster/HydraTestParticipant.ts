import * as fs from 'fs';
import * as path from 'path';
import { CardanoKeyAsync } from 'libcardano';
import { ShelleyWallet, SimpleCip30Wallet } from 'libcardano-wallet';
import { KuberHydraApiProvider } from '../service/KuberHydraApiProvider';
import { Value } from 'libcardano';

export class HydraTestParticipant {
  private httpUrl: string;
  private fundKeyFile: string;
  private nodeKeyFile: string;
  private fundKey: CardanoKeyAsync | null = null;
  private nodeKey: CardanoKeyAsync | null = null;
  private kuberHydraApiProvider: KuberHydraApiProvider;
  private cip30Wallet: SimpleCip30Wallet | null = null;
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
      this.fundKey = await CardanoKeyAsync.fromCardanoCliJson(JSON.parse(fundKeyContent));
    }
    if (!this.nodeKey) {
      const nodeKeyContent = fs.readFileSync(this.nodeKeyFile, 'utf-8');
      this.nodeKey = await CardanoKeyAsync.fromCardanoCliJson(JSON.parse(nodeKeyContent));
    }
  }

  public async getFundKey(): Promise<CardanoKeyAsync> {
    await this.loadKeys();
    if (!this.fundKey) {
      throw new Error('Fund key not loaded.');
    }
    return this.fundKey;
  }

  public async getNodeKey(): Promise<CardanoKeyAsync> {
    await this.loadKeys();
    if (!this.nodeKey) {
      throw new Error('Node key not loaded.');
    }
    return this.nodeKey;
  }

  public getKuberHydraUrl(): string {
    return this.httpUrl;
  }

  public async getCip30Wallet(): Promise<SimpleCip30Wallet> {
    if (!this.cip30Wallet) {
      const shelleyWallet = new ShelleyWallet(await this.getFundKey());
      this.cip30Wallet = new SimpleCip30Wallet(this.kuberHydraApiProvider, this.kuberHydraApiProvider, shelleyWallet, 0);
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
