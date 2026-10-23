/**
 * Injected-wallet connection (MetaMask, Rabby, OKX…). Connecting puts the wallet on
 * Somnia Tokyo testnet and binds it to the SDK, so trims and closes are signed by the user.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider } from 'viem';
import { chain, exchange, HTTP_RPC_URL } from './somnia';

declare global {
  interface Window {
    ethereum?: EIP1193Provider & {
      on?: (event: string, cb: (...args: any[]) => void) => void;
      removeListener?: (event: string, cb: (...args: any[]) => void) => void;
    };
  }
}

const CHAIN_HEX = `0x${chain.id.toString(16)}`;

interface WalletState {
  /** Connected wallet, null when disconnected. */
  address: Address | null;
  onRightChain: boolean;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<Address | null>;
  switchChain: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

async function ensureChain(provider: EIP1193Provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch (err: any) {
    // 4902: the wallet does not know this chain yet.
    if (err?.code !== 4902 && err?.data?.originalError?.code !== 4902) throw err;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: 'Somnia Tokyo Testnet',
          nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
          rpcUrls: [HTTP_RPC_URL],
        },
      ],
    });
  }
}

function describe(err: any): string {
  if (err?.code === 4001) return 'Request rejected in wallet.';
  return err?.shortMessage ?? err?.message ?? 'Wallet error.';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bind or unbind the SDK signer whenever the account or chain changes.
  useEffect(() => {
    if (!provider || !address || chainId !== chain.id) {
      exchange.setSigner({});
      return;
    }
    exchange.setSigner({ walletClient: createWalletClient({ account: address, chain, transport: custom(provider) }) });
  }, [provider, address, chainId]);

  // Restore a previous session silently and follow wallet-side changes.
  useEffect(() => {
    if (!provider) return;
    provider.request({ method: 'eth_accounts' }).then((accs) => {
      if (accs[0] && localStorage.getItem('apexperp:connected') === '1') setAddress(getAddress(accs[0]));
    });
    provider.request({ method: 'eth_chainId' }).then((id) => setChainId(Number(id)));

    const onAccounts = (accs: string[]) => setAddress(accs[0] ? getAddress(accs[0]) : null);
    const onChain = (id: string) => setChainId(Number(id));
    provider.on?.('accountsChanged', onAccounts);
    provider.on?.('chainChanged', onChain);
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
    };
  }, [provider]);

  const switchChain = useCallback(async () => {
    if (!provider) return;
    setError(null);
    try {
      await ensureChain(provider);
      setChainId(chain.id);
    } catch (err) {
      setError(describe(err));
    }
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) {
      setError('No browser wallet found. Install MetaMask or Rabby.');
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      const accs = await provider.request({ method: 'eth_requestAccounts' });
      const next = getAddress(accs[0]);
      await ensureChain(provider);
      setChainId(chain.id);
      setAddress(next);
      try {
        localStorage.setItem('apexperp:connected', '1');
      } catch {}
      return next;
    } catch (err) {
      setError(describe(err));
      return null;
    } finally {
      setConnecting(false);
    }
  }, [provider]);

  const disconnect = useCallback(() => {
    setAddress(null);
    try {
      localStorage.removeItem('apexperp:connected');
    } catch {}
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      onRightChain: chainId === chain.id,
      connecting,
      error,
      hasProvider: !!provider,
      connect,
      switchChain,
      disconnect,
    }),
    [address, chainId, connecting, error, provider, connect, switchChain, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
