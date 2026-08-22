import React, { useEffect, useMemo, useRef, useState } from 'react';

// Styled, searchable country dropdown replacing bare native <select>s.
// Full theme control over the trigger AND the popup panel (native option
// popups ignore Tailwind entirely).
export default function CountryCombobox({
  value,
  onChange,
  countries,
  placeholder = 'Select jurisdiction',
  triggerClassName,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const boxRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    } else {
      setSearch('');
    }
  }, [open]);

  const selected = countries.find((c) => c.code === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? countries.filter(
          (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
        )
      : countries;
    return base.slice(0, 80);
  }, [countries, search]);

  const pick = (code) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={
          triggerClassName ||
          `w-full h-12 px-4 flex items-center justify-between rounded-xl border transition-all text-left ${
            open
              ? 'bg-surface-container-high border-primary/40 ring-4 ring-primary/10'
              : 'bg-surface-container-high/50 border-outline-variant/25 hover:border-primary/30'
          }`
        }
      >
        {selected ? (
          <span className="text-sm font-bold text-on-surface truncate">
            {selected.name} <span className="font-mono text-[11px] text-outline">({selected.code})</span>
          </span>
        ) : (
          <span className="text-sm text-outline">{placeholder}</span>
        )}
        <span
          className={`material-symbols-outlined text-[20px] text-outline transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute z-40 mt-2 w-full bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 overflow-hidden animate-[fade-in_0.15s_ease-out]">
          <div className="p-2 border-b border-outline-variant/15 sticky top-0 bg-surface-container-lowest">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">
                search
              </span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filtered[0]) pick(filtered[0].code);
                  }
                  if (e.key === 'Escape') setOpen(false);
                }}
                placeholder="Filter countries..."
                className="w-full h-9 pl-9 pr-3 bg-surface-container rounded-lg text-xs text-on-surface outline-none border-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pick(c.code)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-xs transition-colors ${
                  value === c.code
                    ? 'bg-primary-container/25 text-primary font-bold'
                    : 'text-on-surface hover:bg-primary-container/15'
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="font-mono text-[10px] text-outline shrink-0">
                  {value === c.code ? '\u2713 ' : ''}
                  {c.code}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <div className="px-4 py-5 text-xs text-outline text-center font-mono">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
