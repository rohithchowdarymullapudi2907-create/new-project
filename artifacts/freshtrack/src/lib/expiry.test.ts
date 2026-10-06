import assert from 'node:assert/strict';
import test from 'node:test';
import { daysUntil, expiryLabel, getExpiryStatus, localDateKey } from './expiry';

function offsetDate(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

test('date-only expiry comparisons follow local calendar days', () => {
  assert.equal(daysUntil(offsetDate(-1)), -1);
  assert.equal(daysUntil(offsetDate(0)), 0);
  assert.equal(daysUntil(offsetDate(1)), 1);
  assert.equal(daysUntil(offsetDate(3)), 3);
  assert.equal(daysUntil(offsetDate(4)), 4);
});

test('expiry statuses distinguish expired, today, soon, and fresh', () => {
  assert.equal(getExpiryStatus(offsetDate(-1)), 'expired');
  assert.equal(getExpiryStatus(offsetDate(0)), 'today');
  assert.equal(getExpiryStatus(offsetDate(1)), 'soon');
  assert.equal(getExpiryStatus(offsetDate(3)), 'soon');
  assert.equal(getExpiryStatus(offsetDate(4)), 'fresh');
});

test('expiry labels match the boundary status', () => {
  assert.equal(expiryLabel(offsetDate(-1)), 'Expired 1 day ago');
  assert.equal(expiryLabel(offsetDate(0)), 'Expires today');
  assert.equal(expiryLabel(offsetDate(1)), 'Expires tomorrow');
  assert.equal(expiryLabel(offsetDate(2)), '2 days left');
});
