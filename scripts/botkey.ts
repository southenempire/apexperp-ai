/**
 * Makes a fresh bot key for linked-bot mode and saves it to .env. The key only ever needs a
 * little STT for gas: once linked in the dreamDEX app it can place and cancel orders for your
 * account but can never withdraw. It is a new key, never your account's own.
 *
 *   npm run botkey -- 0xYourDreamDexAccount
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const ENV = resolve(dirname(fileURLToPath(import.meta.url)), '../.env');

const owner = process.argv[2];
if (!owner || !isAddress(owner)) {
  console.error('usage: npm run botkey -- <your dreamDEX account address, 0x...>');
  process.exit(1);
}

const current = existsSync(ENV) ? readFileSync(ENV, 'utf8') : '';
if (/^PRIVATE_KEY=0x[0-9a-fA-F]{64}\s*$/m.test(current)) {
  console.error('.env already has a PRIVATE_KEY, so nothing was changed. Remove that line first if you want a new bot key.');
  process.exit(1);
}

const key = generatePrivateKey();
const address = privateKeyToAccount(key).address;
const withoutOld = current.split('\n').filter((l) => !/^(PRIVATE_KEY|OWNER_ADDRESS)=/.test(l)).join('\n').replace(/\n+$/, '');
writeFileSync(ENV, `${withoutOld}${withoutOld ? '\n' : ''}PRIVATE_KEY=${key}\nOWNER_ADDRESS=${owner}\n`, { mode: 0o600 });

console.log(`Bot key saved to .env (the private key is not printed).\n`);
console.log(`  bot address : ${address}`);
console.log(`  guards      : ${owner}\n`);
console.log('Next:');
console.log('  1. In the dreamDEX app open your wallet, choose "Link a bot", tick Perps, paste the bot address, press "Add bot".');
console.log('     Let the app send the bot some STT for gas, or send a few STT to the bot address yourself.');
console.log('  2. npm run doctor            checks the link and the gas');
console.log('  3. DRY_RUN=1 npm run agent:live   watches your account and logs what it would do');
