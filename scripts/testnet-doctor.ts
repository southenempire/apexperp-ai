/**
 * Preflight for Somnia Tokyo testnet: checks every dependency ApexPerp needs and
 * exits non-zero if any fails. With PRIVATE_KEY set it also checks your wallet, and with
 * OWNER_ADDRESS set it checks the bot link to that dreamDEX account.
 *
 *   npm run doctor
 */

import { erc20Abi, formatEther, formatUnits, isAddress, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';
import { createLinkedKey, linkCoverage } from '../agent/linked';
import { connect, loadPerps, MARGIN_BANK, publicClient } from '../agent/markets';

const results: { name: string; ok: boolean; detail: string }[] = [];

/** Runs a check, retrying once: the public RPC occasionally times out, and that should not read as a failure. */
async function check(name: string, fn: () => Promise<string>) {
  const t0 = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: `${detail} (${Date.now() - t0}ms)` });
      return;
    } catch (err) {
      const transient = /took too long|timeout|timed out|ECONNRESET|fetch failed/i.test((err as Error).message);
      if (attempt === 2 || !transient) {
        results.push({ name, ok: false, detail: (err as Error).message.split('\n')[0] });
        return;
      }
    }
  }
}

async function main() {
  const key = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  const ownerEnv = process.env.OWNER_ADDRESS;
  if (ownerEnv && !isAddress(ownerEnv)) throw new Error('OWNER_ADDRESS must be a 0x address');
  const owner = ownerEnv as Address | undefined;
  const exchange = connect({
    indexerUrl: process.env.INDEXER_URL || 'https://hideki-dev.smk.somnia.host/v1/graphql',
    wsRpcUrl: process.env.WS_RPC_URL || 'wss://api.hideki2.infra.testnet.somnia.network/ws',
    // Read-only checks still need a syntactically valid key to construct the trader.
    privateKey: key ?? `0x${'11'.repeat(32)}`,
  });

  await check('RPC', async () => {
    const [chainId, block] = await Promise.all([publicClient.getChainId(), publicClient.getBlockNumber()]);
    if (chainId !== 50383) throw new Error(`expected chain 50383, got ${chainId}`);
    return `chain ${chainId}, block #${block}`;
  });

  await check('Indexer + perp markets', async () => {
    const perps = await loadPerps(exchange);
    if (perps.length === 0) throw new Error('no perp markets found on the MarginBank');
    return `${perps.length} markets on MarginBank ${MARGIN_BANK}`;
  });

  await check('Mark prices', async () => {
    const perps = await loadPerps(exchange);
    const states = await Promise.all(perps.map((p) => exchange.client.getPerpState(p.pool)));
    const stale = perps.filter((_, i) => !states[i].markPriceOk).map((p) => p.name);
    if (stale.length) throw new Error(`stale mark on ${stale.join(', ')}`);
    return 'all marks live';
  });

  if (key) {
    const signer: Address = privateKeyToAccount(key).address;
    const account = owner ?? signer;

    await check(owner ? 'Bot gas (STT)' : 'Wallet gas (STT)', async () => {
      const bal = await publicClient.getBalance({ address: signer });
      if (bal === 0n) throw new Error(`${signer} has no STT for gas`);
      return `${formatEther(bal)} STT`;
    });

    if (owner) {
      await check('Bot link', async () => {
        const perps = await loadPerps(exchange);
        const { key: linkedKey } = createLinkedKey(owner, key);
        const { linked: ok, missing } = await linkCoverage(linkedKey, perps);
        if (ok.length === 0) throw new Error(`bot ${signer} is not linked to ${owner}. In the dreamDEX app: wallet, Link a bot, tick Perps, paste the bot address`);
        return missing.length ? `linked on ${ok.length} of ${perps.length} markets (not ${missing.map((m) => m.name).join(', ')})` : `linked on all ${perps.length} markets`;
      });
    } else {
      await check('Wallet USDso', async () => {
        const bal = await publicClient.readContract({
          address: SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [signer],
        });
        return `${formatUnits(bal, 18)} USDso in wallet`;
      });
    }

    await check('Margin account', async () => {
      const h = await exchange.client.getAccountHealth(MARGIN_BANK, account);
      return `${account}: equity ${formatUnits(h.equity, 18)} USDso, maintenance ${formatUnits(h.mmReq, 18)}, ${h.marginStatus}`;
    });
  } else {
    console.log('PRIVATE_KEY not set: skipping wallet checks.\n');
  }

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(22)} ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
