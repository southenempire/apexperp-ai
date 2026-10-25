/**
 * Injected-wallet connection (MetaMask, Rabby, OKX…). Connecting puts the wallet on
 * Somnia Tokyo testnet and binds it to the SDK, so trims and closes are signed by the user.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider } from 'viem';
import { chain, exchange, HTTP_RPC_URL, publicClient } from './somnia';

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
  /** The account that trades: the owner's Somnia Account when it has one, else the wallet itself. Null when disconnected. */
  address: Address | null;
  /** The connected browser wallet, which signs. Same as `address` unless trading through a Somnia Account. */
  owner: Address | null;
  viaSmartAccount: boolean;
  /** True while we check whether the connected wallet owns a Somnia Account. */
  resolving: boolean;
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
  if (err?.code === 4001) return 'You cancelled it in your wallet.';
  return err?.shortMessage ?? err?.message ?? 'Your wallet ran into a problem.';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  const [owner, setOwner] = useState<Address | null>(null);
  const [smart, setSmart] = useState<Address | null>(null);
  const [resolved, setResolved] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // dreamDEX accounts are Somnia Accounts: a smart account derived from the owner's address (slot 0).
  // If the connected wallet owns one that exists on-chain, that is the account that holds the margin.
  useEffect(() => {
    setSmart(null);
    setResolved(false);
    if (!owner) return;
    let alive = true;
    const candidate = exchange.client.accounts.addressOf(owner, 0n);
    publicClient
      .getCode({ address: candidate })
      .then((code) => alive && setSmart(code && code !== '0x' ? candidate : null))
      .catch(() => {})
      .finally(() => alive && setResolved(true));
    return () => {
      alive = false;
    };
  }, [owner]);

  // Bind or unbind the SDK signer whenever the account or chain changes.
  useEffect(() => {
    if (!provider || !owner || !resolved || chainId !== chain.id) {
      exchange.setSigner({});
      return;
    }
    try {
      const walletClient = createWalletClient({ account: owner, chain, transport: custom(provider) });
      if (smart) {
        // The wallet is a direct owner (threshold 1), so it only sends; the account is the actor every pool sees.
        const client = exchange.client;
        const inner = client.createExecutor({ walletClient, account: owner });
        const executor = client.createExecutor({ smartAccount: smart, inner });
        exchange.setSigner({ account: { address: smart, executors: { [chain.id]: executor } } });
      } else {
        exchange.setSigner({ walletClient });
      }
    } catch (err) {
      exchange.setSigner({});
      setError(describe(err));
    }
  }, [provider, owner, smart, resolved, chainId]);

  // Restore a previous session silently and follow wallet-side changes.
  useEffect(() => {
    if (!provider) return;
    provider.request({ method: 'eth_accounts' }).then((accs) => {
      if (accs[0] && localStorage.getItem('apexperp:connected') === '1') setOwner(getAddress(accs[0]));
    });
    provider.request({ method: 'eth_chainId' }).then((id) => setChainId(Number(id)));

    const onAccounts = (accs: string[]) => setOwner(accs[0] ? getAddress(accs[0]) : null);
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
      setError("We couldn't find a browser wallet. Install MetaMask or Rabby and try again.");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      const accs = await provider.request({ method: 'eth_requestAccounts' });
      const next = getAddress(accs[0]);
      await ensureChain(provider);
      setChainId(chain.id);
      setOwner(next);
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
    setOwner(null);
    try {
      localStorage.removeItem('apexperp:connected');
    } catch {}
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address: owner && resolved ? (smart ?? owner) : null,
      owner,
      viaSmartAccount: !!smart,
      resolving: !!owner && !resolved,
      onRightChain: chainId === chain.id,
      connecting,
      error,
      hasProvider: !!provider,
      connect,
      switchChain,
      disconnect,
    }),
    [owner, smart, resolved, chainId, connecting, error, provider, connect, switchChain, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
