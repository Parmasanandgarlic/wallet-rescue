// hl-evidence-package.mjs
// Compile evidence for a Hyperliquid support ticket without embedding wallet secrets.

import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey } from './key-config.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const WALLET = account.address;
const API = 'https://api.hyperliquid.xyz/info';

async function query(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  const report = [];
  const log = (line) => { console.log(line); report.push(line); };

  log('HYPERLIQUID ACCOUNT OWNERSHIP EVIDENCE PACKAGE');
  log(`Generated: ${new Date().toISOString()}`);
  log('');

  const proofMessage = `I am the rightful owner of Hyperliquid account ${WALLET}. This account has been compromised via an EIP-7702 delegation attack. An unauthorized party has converted my account to multi-sig, locking me out. I am requesting Hyperliquid support to restore my account. Timestamp: ${new Date().toISOString()}`;
  const signature = await account.signMessage({ message: proofMessage });

  log(`Address: ${WALLET}`);
  log(`Message: "${proofMessage}"`);
  log(`Signature: ${signature}`);
  log('');

  try {
    const fills = await query({ type: 'userFills', user: WALLET });
    if (Array.isArray(fills)) {
      log(`Total fills on record: ${fills.length}`);
      if (fills.length > 0) {
        let totalVolume = 0;
        const assets = new Set();
        let earliest = Infinity;
        let latest = 0;
        for (const f of fills) {
          const notional = Math.abs(parseFloat(f.px) * parseFloat(f.sz));
          totalVolume += notional;
          assets.add(f.coin);
          if (f.time < earliest) earliest = f.time;
          if (f.time > latest) latest = f.time;
        }
        log(`Total volume (from fills): $${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        log(`Assets traded: ${[...assets].join(', ')}`);
        log(`First fill: ${new Date(earliest).toISOString()}`);
        log(`Last fill: ${new Date(latest).toISOString()}`);
      }
    }
  } catch (e) {
    log(`Error fetching fills: ${e.message}`);
  }

  try {
    const referral = await query({ type: 'referral', user: WALLET });
    log(`Referral data: ${JSON.stringify(referral)}`);
  } catch (e) {
    log(`Referral query: ${e.message}`);
  }

  try {
    const ledger = await query({ type: 'userNonFundingLedgerUpdates', user: WALLET });
    if (Array.isArray(ledger)) {
      let totalDeposits = 0;
      let totalWithdrawals = 0;
      let depositCount = 0;
      let withdrawCount = 0;
      for (const entry of ledger) {
        if (entry.delta?.type === 'deposit') {
          totalDeposits += parseFloat(entry.delta.usdc || '0');
          depositCount++;
        } else if (entry.delta?.type === 'withdraw') {
          totalWithdrawals += parseFloat(entry.delta.usdc || '0');
          withdrawCount++;
        }
      }
      log(`Total deposits: ${depositCount} txs - $${totalDeposits.toFixed(2)}`);
      log(`Total withdrawals: ${withdrawCount} txs - $${totalWithdrawals.toFixed(2)}`);
    }
  } catch (e) {
    log(`Ledger error: ${e.message}`);
  }

  try {
    const agents = await query({ type: 'extraAgents', user: WALLET });
    log(`Authorized agents: ${JSON.stringify(agents, null, 2)}`);
  } catch (e) {
    log(`Agent query error: ${e.message}`);
  }

  log('');
  log('Observed lockout: user-signed Hyperliquid actions returned multi-sig-required errors after the compromise.');
  log('Request: remove unauthorized multi-sig, restore rightful access, and preserve account history/eligibility where possible.');

  const fs = await import('fs');
  const filename = `hl-evidence-${Date.now()}.txt`;
  fs.writeFileSync(filename, report.join('\n'), 'utf-8');
  console.log(`Evidence saved to: ${filename}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
