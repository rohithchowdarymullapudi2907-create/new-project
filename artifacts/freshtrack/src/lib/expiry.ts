export type ExpiryStatus = 'expired' | 'today' | 'soon' | 'fresh';

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysUntil(dateOnly: string): number {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const today = new Date();
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86400000);
}

export function getExpiryStatus(dateOnly: string): ExpiryStatus {
  const days = daysUntil(dateOnly);
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days <= 3) return 'soon';
  return 'fresh';
}

export function expiryLabel(dateOnly: string): string {
  const days = daysUntil(dateOnly);
  if (days < 0) return `Expired ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
}

export function prettyDate(dateOnly?: string | null): string {
  if (!dateOnly) return 'Not set';
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
