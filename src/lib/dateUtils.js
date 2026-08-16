import { format as _format, formatDistanceToNow as _formatDistanceToNow, parseISO, isValid } from 'date-fns';

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

export function format(value, fmt, options) {
  const d = toDate(value);
  if (!d) return '\u2014';
  try { return _format(d, fmt, options); } catch { return '\u2014'; }
}

export function formatDistanceToNow(value, options) {
  const d = toDate(value);
  if (!d) return '\u2014';
  try { return _formatDistanceToNow(d, options); } catch { return '\u2014'; }
}

export { parseISO, isValid };
export { toDate as safeDate };
