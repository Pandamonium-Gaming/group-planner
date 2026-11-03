export function toWowCopper(gold: number, silver: number, copper: number): number {
  const amounts = [gold, silver, copper];
  const total = gold * 10000 + silver * 100 + copper;
  if (amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0)
    || silver > 99 || copper > 99 || !Number.isSafeInteger(total)) {
    throw new RangeError('Invalid gold, silver or copper amount');
  }
  return total;
}

export function splitWowCopper(amount: number) {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError('Currency amount must be a safe integer');
  }
  const absolute = Math.abs(amount);
  return {
    gold: Math.floor(absolute / 10000),
    silver: Math.floor(absolute / 100) % 100,
    copper: absolute % 100,
  };
}
