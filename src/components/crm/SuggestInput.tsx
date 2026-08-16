import { useState, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';

interface SuggestInputProps {
  /** Current input value. */
  value: string;
  /** Called with the new value on type or selection. */
  onChange: (value: string) => void;
  /** Suggestions to offer; the list self-populates from existing records. */
  options: string[];
  /** Input `id`, for label association. */
  id?: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Maximum input length. */
  maxLength?: number;
  /** Force the value to uppercase on typing and selection (e.g. ISO country codes). */
  uppercase?: boolean;
}

/**
 * Free-text input with a readable, self-styled suggestion dropdown - a
 * replacement for the native `<datalist>`, whose popup renders unstyled (and, on
 * some browsers, near-invisible) text we can't control via CSS. The field stays
 * free text: suggestions only assist, they never constrain what can be typed.
 * The dropdown is shown only when there are matches, so it's never an empty box,
 * and an exact match is filtered out (no point re-suggesting what's already typed).
 */
export default function SuggestInput({ value, onChange, options, id, placeholder, maxLength, uppercase }: SuggestInputProps) {
  const [open, setOpen] = useState(false);
  const emit = (v: string) => onChange(uppercase ? v.toUpperCase() : v);
  const q = (value || '').trim().toLowerCase();
  const normalized = uppercase ? Array.from(new Set(options.map((o) => o.toUpperCase()))) : options;
  const matches = normalized
    .filter((o) => o && o.toLowerCase().includes(q) && o.toLowerCase() !== q)
    .slice(0, 8);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(e: ChangeEvent<HTMLInputElement>) => emit(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-md">
          {matches.map((o) => (
            <li key={o}>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100"
                // mousedown (not click) so selection runs before the input's blur
                onMouseDown={(e) => { e.preventDefault(); emit(o); setOpen(false); }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
