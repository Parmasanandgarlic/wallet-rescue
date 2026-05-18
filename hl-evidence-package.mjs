// hl-evidence-package.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Compile evidence for Hyperliquid support ticket:
// - Prove ownership via cryptographic signature
// - Show account history (volume, deposits, withdrawals)
// - Document the unauthorized multi-sig change
// ─────────────────────────────────────────────────────────────────────────────

import { privateKeyToAccount } from 'viem/accounts';

const COMPROMISED_KEY = '0x60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const account = privateKeyToAccount(COMPROMISED_KEY);
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

  log('╔═══════════════════════════════════════════════════════════════╗');
  log('║  HYPERLIQUID ACCOUNT OWNERSHIP EVIDENCE PACKAGE              ║');
  log('║  Generated: ' + new Date().toISOString().padEnd(48) + '║');
  log('╚═══════════════════════════════════════════════════════════════╝');
  log('');

  // ── 1. Cryptographic Proof of Ownership ────────────────────────────────
  log('━━━ 1. CRYPTOGRAPHIC PROOF OF OWNERSHIP ━━━━━━━━━━━━━━━━━━━━━━━');
  log('');

  const proofMessage = `I am the rightful owner of Hyperliquid account ${WALLET}. This account has been compromised via an EIP-7702 delegation attack. An unauthorized party has converted my account to multi-sig, locking me out. I am requesting Hyperliquid support to restore my account. Timestamp: ${new Date().toISOString()}`;

  const signature = await account.signMessage({ message: proofMessage });

  log(`  Address:   ${WALLET}`);
  log(`  Message:   "${proofMessage}"`);
  log(`  Signature: ${signature}`);
  log('');
  log('  ✅ This signature cryptographically proves possession of the');
  log('     private key that created this account.');
  log('');

  // ── 2. Account Trading History ─────────────────────────────────────────
  log('━━━ 2. ACCOUNT TRADING HISTORY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');

  try {
    const fills = await query({ type: 'userFills', user: WALLET });
    if (Array.isArray(fills)) {
      log(`  Total fills on record: ${fills.length}`);
      if (fills.length > 0) {
        // Calculate total volume
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
        log(`  Total volume (from fills): $${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        log(`  Assets traded: ${[...assets].join(', ')}`);
        log(`  First fill: ${new Date(earliest).toISOString()}`);
        log(`  Last fill:  ${new Date(latest).toISOString()}`);
        log(`  (Note: API may cap at 2000 fills — actual volume is higher)`);
      }
    }
  } catch (e) {
    log(`  Error fetching fills: ${e.message}`);
  }
  log('');

  // ── 3. Points / Rewards Status ─────────────────────────────────────────
  log('━━━ 3. POINTS / REWARDS STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');

  try {
    const referral = await query({ type: 'referral', user: WALLET });
    log(`  Referral data: ${JSON.stringify(referral)}`);
  } catch (e) {
    log(`  Referral query: ${e.message}`);
  }

  try {
    const portfolio = await query({ type: 'portfolio', user: WALLET });
    if (portfolio) {
      log(`  Portfolio data available: ${JSON.stringify(portfolio).slice(0, 200)}`);
    }
  } catch (e) {
    log(`  Portfolio query: ${e.message}`);
  }
  log('');

  // ── 4. Deposit/Withdrawal History ──────────────────────────────────────
  log('━━━ 4. DEPOSIT & WITHDRAWAL HISTORY ━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');

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

      log(`  Total deposits:     ${depositCount} txs — $${totalDeposits.toFixed(2)}`);
      log(`  Total withdrawals:  ${withdrawCount} txs — $${totalWithdrawals.toFixed(2)}`);

      if (ledger.length > 0) {
        const first = new Date(ledger[0].time).toISOString();
        const last = new Date(ledger[ledger.length - 1].time).toISOString();
        log(`  First activity: ${first}`);
        log(`  Last activity:  ${last}`);
      }
    }
  } catch (e) {
    log(`  Error: ${e.message}`);
  }
  log('');

  // ── 5. Authorized Agents (showing legitimate usage) ────────────────────
  log('━━━ 5. AUTHORIZED AGENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');

  try {
    const agents = await query({ type: 'extraAgents', user: WALLET });
    if (Array.isArray(agents)) {
      for (const a of agents) {
        const valid = new Date(a.validUntil).toISOString();
        log(`  ${a.name.padEnd(20)} ${a.address}  valid until ${valid}`);
      }
    }
  } catch (e) {
    log(`  Error: ${e.message}`);
  }
  log('');

  // ── 6. Current Multi-Sig Lockout Evidence ──────────────────────────────
  log('━━━ 6. MULTI-SIG LOCKOUT EVIDENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');
  log('  Every user-signed action returns "Multi-sig required":');
  log('  - noop:            ❌ Multi-sig required');
  log('  - approveAgent:    ❌ Multi-sig required');
  log('  - withdraw3:       ❌ Multi-sig required');
  log('  - usdSend:         ❌ Multi-sig required');
  log('  - convertToMultiSigUser: ❌ Multi-sig required');
  log('');
  log('  An unauthorized party added themselves as a multi-sig signer');
  log('  after compromising the private key via an EIP-7702 delegation');
  log('  exploit on Polygon network.');
  log('');

  // ── 7. Attack Timeline ─────────────────────────────────────────────────
  log('━━━ 7. ATTACK TIMELINE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');
  log('  1. Attacker gained control via malicious EIP-7702 delegation');
  log('  2. Private key was compromised through the delegation');
  log('  3. Attacker added their address as multi-sig signer on Hyperliquid');
  log('  4. Account is now locked — owner cannot perform ANY actions');
  log('  5. EIP-7702 delegations have been revoked on all chains');
  log('  6. But Hyperliquid multi-sig remains — requires support intervention');
  log('');

  // ── 8. Request ─────────────────────────────────────────────────────────
  log('━━━ 8. REQUEST TO HYPERLIQUID SUPPORT ━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');
  log('  1. Remove the unauthorized multi-sig configuration');
  log('  2. Restore single-signer (EOA) access to the rightful owner');
  log('  3. Preserve account history, points, and airdrop eligibility');
  log('  4. If account cannot be restored, migrate points/history to a');
  log('     new clean wallet owned by the same user');
  log('');
  log('  The cryptographic signature above proves the requester holds');
  log('  the original private key for this account.');
  log('');
  log('╔═══════════════════════════════════════════════════════════════╗');
  log('║  END OF EVIDENCE PACKAGE                                     ║');
  log('╚═══════════════════════════════════════════════════════════════╝');

  // Write to file for easy copy-paste
  const fs = await import('fs');
  const filename = `hl-evidence-${Date.now()}.txt`;
  fs.writeFileSync(filename, report.join('\n'), 'utf-8');
  console.log(`\n📄 Evidence saved to: ${filename}`);
  console.log('   Copy this entire file into your Hyperliquid support ticket.');
}

main().catch(console.error);
