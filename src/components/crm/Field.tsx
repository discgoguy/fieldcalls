import type { ReactNode } from 'react';

/** Label/value pair for CRM detail pages. Renders nothing when value is empty. */
export default function Field({ label, value }: {
  /** Field label (small, uppercase). */
  label: string;
  /** Field value; the component renders nothing when this is empty. */
  value?: ReactNode;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-800">{value}</div>
    </div>
  );
}
