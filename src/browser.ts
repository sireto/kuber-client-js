import { CardanoExtension, Cip30Provider, Cip30ProviderWrapper, CipExtension } from "libcardano-wallet/cip30";

declare global {
  interface Window {
    cardano: Record<string, CardanoExtension>;
  }
}

export class BrowserCardanoExtension {
  apiVersion: string;
  enable(options?: { extensions: CipExtension[] }): Promise<Cip30Provider> {
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
