// phase2-polygon-race.mjs
// Polygon-only EIP-7702 revocation race. Wallet key is runtime-only.

import { createWalletClient, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { requireCompromisedKey } from './key-config.mjs';

const account = privateKeyToAccount(requireCompromisedKey());

async function revokeOnPolygon() {
  try {
    console.log(`Account: ${account.address}`);
    const walletClient = createWalletClient({ account, chain: polygon, transport: http() });
    const authorization = await walletClient.signAuthorization({
      contractAddress: zeroAddress,
      executor: 'self',
    });
    const txHash = await walletClient.sendTransaction({
      to: account.address,
      authorizationList: [authorization],
      value: 0n,
    });
    console.log(`Polygon revocation submitted: ${txHash}`);
    console.log(`https://polygonscan.com/tx/${txHash}`);
  } catch (error) {
    console.error(`Polygon revocation failed: ${error.shortMessage || error.message}`);
    process.exit(1);
  }
}

revokeOnPolygon().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
