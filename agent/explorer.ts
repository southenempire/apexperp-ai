/** Somnia Tokyo (Hideki) block explorer, where every transaction ApexPerp sends can be checked. */
export const EXPLORER_TX = 'https://explorer.testnet.somnia.network/tokyo/tx/';
export const explorerTx = (hash: string) => `${EXPLORER_TX}${hash}`;
