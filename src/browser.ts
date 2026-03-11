import { CardanoExtension, Cip30, Cip30ProviderWrapper, CipExtension } from "libcardano-wallet";

declare global {
  interface Window {
    cardano: Record<string, CardanoExtension>;
  }
}

export class BrowserCardanoExtension {
  apiVersion: string;
  async enable(options?: { extensions: CipExtension[] }): Promise<Cip30> {
    return this.__provider.enable(options).then((instance) => new Cip30ProviderWrapper(instance));
  }

  icon: string;
  isEnabled(): Promise<Boolean> {
    return this.__provider.isEnabled();
  }
  name: string;
  __provider: CardanoExtension;
  supportedExtensions?: Record<string, any>[];
  constructor(provider: CardanoExtension) {
    this.__provider = provider;
    this.apiVersion = provider.apiVersion;
    this.icon = provider.icon;
    this.name = provider.name;
    this.supportedExtensions = provider.supportedExtensions;
  }
  static getProviderByName(name: string): BrowserCardanoExtension | null {
    const providers = BrowserCardanoExtension.list();
    const provider = providers.find((x) => x.name === name);
    return provider || null;
  }
  static getByWindowCardano(key:string): BrowserCardanoExtension {
    const provider = window?.cardano?.[key];
    if (!provider) {
      throw new Error(`No provider found for key ${key}`);
    }
    return new BrowserCardanoExtension(provider);
  }

  static list(): BrowserCardanoExtension[] {
    const pluginMap = new Map();
    if (!window?.cardano) {
      return [];
    }
    Object.keys(window?.cardano || {}).forEach((x) => {
      const plugin: CardanoExtension = window.cardano[x];
      if (!!plugin.enable && plugin.name) {
        pluginMap.set(plugin.name, plugin);
      }
    });
    const providers = Array.from(pluginMap.values());
    console.info("BrowserCardanoExtension.list", providers);
    return providers.map((x) => new BrowserCardanoExtension(x));
  }
}
