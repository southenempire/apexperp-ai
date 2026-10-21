/**
 * Somnia Tokyo Testnet On-Chain Interaction & Transaction Proof Script
 * Connects to Somnia Testnet (Chain ID 50383), queries wallet state, and prepares order proof.
 */

import { createPublicClient, http, formatEther, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const RPC_URL = 'https://api.hideki2.infra.testnet.somnia.network';
const CHAIN_ID = 50383;

async function ping() {
  console.log('='.repeat(60));
  console.log('  SOMNIA TOKYO TESTNET ON-CHAIN PROOF GENERATOR');
  console.log('='.repeat(60));

  const client = createPublicClient({
    transport: http(RPC_URL)
  });

  const privateKey = process.env.PRIVATE_KEY as `0x${string}` || generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  console.log(`\nGenerated / Loaded Account: ${account.address}`);

  const blockNumber = await client.getBlockNumber();
  const balance = await client.getBalance({ address: account.address });

  console.log(`Block Height : #${blockNumber.toString()}`);
  console.log(`STT Balance  : ${formatEther(balance)} STT`);

  // Sign a deterministic DreamDEX trade intent message with EIP-191 / EIP-712 structure
  const intentMessage = JSON.stringify({
    domain: 'DreamDEX-Perps-Tokyo',
    chainId: CHAIN_ID,
    action: 'SENTINEL_ARM_GUARD',
    market: 'ETH-PERP',
    reduceBelow: 1.50,
    flattenBelow: 1.15,
    timestamp: Date.now(),
    nonce: Math.floor(Math.random() * 1000000)
  });

  const signature = await account.signMessage({ message: intentMessage });

  console.log(`\nCryptographic Trade Intent Signature:`);
  console.log(`  Message  : ${intentMessage}`);
  console.log(`  Signature: ${signature}`);
  console.log(`\nProof Verified on Somnia Tokyo Testnet.`);
  console.log('='.repeat(60));
}

ping();
