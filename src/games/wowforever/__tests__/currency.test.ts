import { splitWowCopper, toWowCopper } from '../currency';

it.each([
  [0, 0, 1, 1],
  [0, 1, 0, 100],
  [1, 0, 0, 10000],
  [12, 34, 56, 123456],
  [0, 99, 99, 9999],
  [900719925474, 9, 91, Number.MAX_SAFE_INTEGER],
])('converts %ig %is %ic exactly to %i copper and back', (gold, silver, copper, total) => {
  expect(toWowCopper(gold, silver, copper)).toBe(total);
  expect(splitWowCopper(total)).toEqual({ gold, silver, copper });
  expect(splitWowCopper(-total)).toEqual({ gold, silver, copper });
});

it.each([
  [-1, 0, 0], [1.25, 0, 0], [0, -1, 0], [0, 100, 0],
  [0, 0, 100], [0, 0, 0.1], [NaN, 0, 0], [Infinity, 0, 0],
  [900719925474, 9, 92],
])('rejects invalid denominations or unsafe totals (%s, %s, %s)', (gold, silver, copper) => {
  expect(() => toWowCopper(gold, silver, copper)).toThrow(RangeError);
});
