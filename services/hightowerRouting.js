// Dedicated executor routing; an ordinary Reporter never receives this lane.
export const HT_COMMAND = 'HIGHTOWER_CONTROL';
export const HT_ACTIONS = Object.freeze(['PAUSE','RESUME','BUY_ONLY','SELL_ONLY','AUTO_DIRECTION','MANAGE_ONLY','CLOSE_ALL','CLOSE_PROFITS','EMERGENCY_STOP','RESET_EMERGENCY']);
export function hightowerMatches(record, scope = {}) {
  const dedicated = record.command === HT_COMMAND;
  if (scope.executionTarget !== 'hightower') return !dedicated;
  const p = record.payload || {};
  return dedicated && record.accountId === scope.accountId &&
    String(p.symbol) === String(scope.symbol) && Number(p.magicNumber) === Number(scope.magicNumber) &&
    (!p._receiverId || p._receiverId === scope.receiverId);
}
export function validateHightowerScope(body) {
  if (!/^[A-Za-z0-9_.#-]{1,24}$/.test(body.symbol || '') || !Number.isInteger(body.magicNumber) || body.magicNumber <= 0 || body.magicNumber > 2147483647) throw new Error('Exact broker symbol and positive EA magic number required');
  return {symbol: body.symbol, magicNumber: body.magicNumber};
}
