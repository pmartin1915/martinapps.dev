import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { pickHoliday, easter, thanksgiving } = createRequire(import.meta.url)('../assets/holiday.js');
const d = (y, m, day) => pickHoliday(new Date(y, m - 1, day));
test('thanksgiving is the 4th Thursday', () => {
  const want = { 2026: 26, 2027: 25, 2028: 23, 2029: 22, 2030: 28 };
  for (const y in want) assert.equal(thanksgiving(+y), want[y]);
});
test('easter by the computus', () => {
  const want = { 2026: [4, 5], 2027: [3, 28], 2028: [4, 16], 2029: [4, 1], 2030: [4, 21] };
  for (const y in want) assert.deepEqual(easter(+y), want[y]);
});
test('every boundary, 2026-2030', () => {
  for (let y = 2026; y <= 2030; y++) {
    const t = thanksgiving(y), e = easter(y), E = (n) => { const x = new Date(y, e[0] - 1, e[1] + n); return pickHoliday(x); };
    assert.equal(d(y, 2, 12), null); assert.equal(d(y, 2, 13), 'valentines'); assert.equal(d(y, 2, 14), 'valentines'); assert.equal(d(y, 2, 15), null);
    assert.equal(d(y, 3, 16), null); assert.equal(d(y, 3, 17), 'stpatricks'); assert.equal(d(y, 3, 18), null);
    assert.equal(E(-3), null); assert.equal(E(-2), 'easter'); assert.equal(E(0), 'easter'); assert.equal(E(1), 'easter'); assert.equal(E(2), null);
    assert.equal(d(y, 7, 2), null); assert.equal(d(y, 7, 3), 'july4'); assert.equal(d(y, 7, 5), 'july4'); assert.equal(d(y, 7, 6), null);
    assert.equal(d(y, 10, 24), null); assert.equal(d(y, 10, 25), 'halloween'); assert.equal(d(y, 10, 31), 'halloween'); assert.equal(d(y, 11, 1), null);
    assert.equal(d(y, 11, t - 1), null); for (let k = 0; k < 4; k++) assert.equal(pickHoliday(new Date(y, 10, t + k)), 'thanksgiving');
    assert.equal(pickHoliday(new Date(y, 10, t + 4)), t + 4 > 30 ? 'christmas' : null);
    assert.equal(d(y, 12, 1), t + 3 >= 31 ? 'thanksgiving' : 'christmas'); assert.equal(d(y, 12, 26), 'christmas'); assert.equal(d(y, 12, 27), null);
    assert.equal(d(y, 12, 30), null); assert.equal(d(y, 12, 31), 'newyear'); assert.equal(d(y, 1, 1), 'newyear'); assert.equal(d(y, 1, 2), 'newyear'); assert.equal(d(y, 1, 3), null);
  }
});
