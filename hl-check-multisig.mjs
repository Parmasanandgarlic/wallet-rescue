// hl-check-multisig.mjs
// Query Hyperliquid account state to see multi-sig config, agents, balances
// This is READ-ONLY — no signing needed

const WALLET = '0xB4a63785780B159BAa1D4EC50f1e1cE8Fbb67df9';
const API = 'https://api.hyperliquid.xyz/info';

async function query(type, user) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, user }),
  });
  return res.json();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  HYPERLIQUID ACCOUNT RECON — READ ONLY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Wallet: ${WALLET}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Check clearing house state (perps balances, positions)
  console.log('── Perps Account State ─────────────────────────────────────');
  try {
    const state = await query('clearinghouseState', WALLET);
    console.log(`  Margin Summary:`);
    console.log(`    Account Value:  $${state.marginSummary?.accountValue}`);
    console.log(`    Total Margin:   $${state.marginSummary?.totalMarginUsed}`);
    console.log(`    Withdrawable:   $${state.crossMarginSummary?.totalRawUsd || state.withdrawable}`);
    if (state.assetPositions?.length) {
      console.log(`\n  Open Positions (${state.assetPositions.length}):`);
      for (const p of state.assetPositions) {
        const pos = p.position;
        console.log(`    ${pos.coin}: ${pos.szi} @ ${pos.entryPx} | PnL: ${pos.unrealizedPnl}`);
      }
    } else {
      console.log('  No open positions.');
    }
  } catch (e) {
    console.error('  Failed:', e.message);
  }

  // 2. Check spot balances
  console.log('\n── Spot Balances ───────────────────────────────────────────');
  try {
    const spot = await query('spotClearinghouseState', WALLET);
    if (spot.balances?.length) {
      for (const b of spot.balances) {
        console.log(`    ${b.coin}: ${b.total} (hold: ${b.hold})`);
      }
    } else {
      console.log('  No spot balances.');
    }
  } catch (e) {
    console.error('  Failed:', e.message);
  }

  // 3. Check extra agents (API wallets)
  console.log('\n── Authorized Agents / API Wallets ─────────────────────────');
  try {
    const agents = await query('extraAgents', WALLET);
    if (agents?.length) {
      for (const a of agents) {
        console.log(`    Agent: ${a.address} | Name: ${a.name || '(unnamed)'} | Active: ${a.isActive}`);
      }
    } else {
      console.log('  No extra agents found (or API returned empty).');
    }
    console.log('  Raw response:', JSON.stringify(agents, null, 2));
  } catch (e) {
    console.error('  Failed:', e.message);
  }

  // 4. Try to get multi-sig info via generic meta query
  console.log('\n── Multi-Sig / Account Config ──────────────────────────────');
  try {
    // Try the multiSig info endpoint
    const msRes = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'multiSig', user: WALLET }),
    });
    const msData = await msRes.json();
    console.log('  Multi-sig response:', JSON.stringify(msData, null, 2));
  } catch (e) {
    console.error('  Failed:', e.message);
  }

  // 5. Try clearinghouseState for additional fields
  console.log('\n── Full Raw State (key fields) ─────────────────────────────');
  try {
    const raw = await query('clearinghouseState', WALLET);
    // Log everything except positions for brevity
    const { assetPositions, ...rest } = raw;
    console.log(JSON.stringify(rest, null, 2));
  } catch (e) {
    console.error('  Failed:', e.message);
  }

  // 6. Recent account actions / transfers
  console.log('\n── Recent User Actions (last 20) ───────────────────────────');
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userNonFundingLedgerUpdates', user: WALLET }),
    });
    const ledger = await res.json();
    const recent = Array.isArray(ledger) ? ledger.slice(-20) : [];
    for (const entry of recent) {
      const t = new Date(entry.time).toISOString();
      const delta = entry.delta;
      console.log(`  ${t} | ${delta?.type || 'unknown'} | ${JSON.stringify(delta).slice(0, 120)}`);
    }
    if (!recent.length) console.log('  No recent ledger entries.');
  } catch (e) {
    console.error('  Failed:', e.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ⚠️  SHARE THIS OUTPUT WITH HYPERLIQUID SUPPORT');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
