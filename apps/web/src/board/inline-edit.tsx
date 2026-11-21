import { cn } from '@archboard/ui';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Inline text editor used on the canvas (UX §5.3): Enter confirms (Ctrl/⌘+Enter when multi-line),
 * Esc cancels, blur confirms, and an empty single-line value reverts.
 */
export function InlineEdit({
  value,
  onCommit,
  onDone,
  multiline = false,
  allowEmpty = false,
  className,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onCommit: (next: string) => void;
  onDone: () => void;
  multiline?: boolean;
  allowEmpty?: boolean;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    // A just-created node stays invisible until React Flow has measured it, and hidden elements
    // can't take focus — so keep trying for a few frames until focus actually lands.
    let frame = 0;
    let tries = 0;
    const tryFocus = () => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      if (document.activeElement === el) {
        el.select();
        return;
      }
      if (tries++ < 20) frame = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return; // blur fires after Enter/Esc; only act once
    done.current = true;
    if (save) {
      const next = multiline ? draft : draft.trim();
      if ((multiline || allowEmpty || next) && next !== value) onCommit(next);
    }
    onDone();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // keep Delete/Backspace/shortcuts inside the editor
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
    if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      finish(true);
    }
  };

  const common = {
    value: draft,
    'aria-label': ariaLabel,
    placeholder,
    onBlur: () => finish(true),
    onKeyDown,
    className: cn('nodrag nopan nowheel w-full bg-transparent outline-none', className),
  };
  return multiline ? (
    <textarea ref={ref} {...common} onChange={(e) => setDraft(e.target.value)} />
  ) : (
    <input ref={ref} {...common} maxLength={80} onChange={(e) => setDraft(e.target.value)} />
  );
}
