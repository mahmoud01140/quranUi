import { useEffect, useRef } from 'react';

/* Mobile-first chat composer used by the discussion pages.
   - Auto-grows from one row up to `maxRows`, then scrolls internally.
   - 16px font at every breakpoint so iOS Safari never focus-zooms the page.
   - Enter sends on desktop; on touch devices Enter inserts a newline and
     sending happens through the button (the WhatsApp convention). */
export default function AutoGrowTextarea({
  value,
  onChange,
  onSend,
  placeholder,
  disabled = false,
  maxRows = 5,
  textareaRef,
  className = '',
}) {
  const innerRef = useRef(null);
  const ref = textareaRef || innerRef;

  const coarsePointer = useRef(false);
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    coarsePointer.current = window.matchMedia('(pointer: coarse)').matches;
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 24 * maxRows + 20; // 24px line-height × rows + vertical padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, maxRows, ref]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !coarsePointer.current) {
      e.preventDefault();
      onSend?.();
    }
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label={placeholder}
      disabled={disabled}
      enterKeyHint={coarsePointer.current ? 'enter' : 'send'}
      className={`block w-full min-w-0 resize-none bg-[#FBF7EE] border border-[#E8E2D4] focus:border-[#177B58] focus:bg-white rounded-xl px-3.5 py-2.5 text-[16px] leading-6 text-[#2A2438] outline-none transition-colors placeholder:text-[#756E85] disabled:opacity-60 ${className}`}
    />
  );
}
