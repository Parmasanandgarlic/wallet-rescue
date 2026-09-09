export function mayRetryRpcFailure({
  broadcastAttempted,
  attemptIndex,
  totalAttempts,
}) {
  if (broadcastAttempted) return false;
  return Number.isInteger(attemptIndex)
    && Number.isInteger(totalAttempts)
    && attemptIndex >= 0
    && totalAttempts > 0
    && attemptIndex < totalAttempts - 1;
}
