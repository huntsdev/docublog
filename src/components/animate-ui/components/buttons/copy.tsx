// Adapted from Animate UI's Copy Button:
// https://animate-ui.com/docs/components/buttons/copy
// https://animate-ui.com/r/components-buttons-copy.json
// Uses the upstream button primitive with site-native CSS, animated labels, and a drawn checkmark.
// Adds accessible clipboard feedback, fallback copying, timer cleanup, and reduced motion.
// License: ../../LICENSE
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CopyIcon, XIcon } from 'lucide-react';
import { Button as ButtonPrimitive, type ButtonProps as ButtonPrimitiveProps } from '../../primitives/buttons/button';
import { useControlledState } from '../../hooks/use-controlled-state';

type CopyButtonProps = Omit<ButtonPrimitiveProps, 'children'> & {
  content: string;
  copied?: boolean;
  onCopiedChange?: (copied: boolean, content?: string) => void;
  delay?: number;
  variant?: 'default' | 'accent' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon';
};

const visuallyHidden: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
};

async function copyContent(content: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return;
    } catch {
      // Older or restricted browsers can still support copying from a selection.
    }
  }

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = document.getSelection();
  const previousRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.append(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
  } finally {
    textarea.remove();
    previousFocus?.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      previousRanges.forEach(range => selection.addRange(range));
    }
  }
}

function CopyButton({
  className,
  content,
  copied,
  onCopiedChange,
  onClick,
  variant = 'default',
  size = 'default',
  delay = 3000,
  'aria-label': accessibleLabel = 'Copy code',
  title,
  ...props
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useControlledState<boolean, [content?: string]>({
    value: copied,
    defaultValue: false,
    onChange: onCopiedChange,
  });
  const [failed, setFailed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);
  const mounted = useRef(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || isCopied || pending.current) return;
    pending.current = true;
    clearTimeout(resetTimer.current);
    setFailed(false);
    try {
      await copyContent(content);
      if (!mounted.current) return;
      setIsCopied(true, content);
      resetTimer.current = setTimeout(() => {
        setIsCopied(false);
      }, delay);
    } catch {
      if (!mounted.current) return;
      setFailed(true);
      resetTimer.current = setTimeout(() => setFailed(false), delay);
    } finally {
      pending.current = false;
    }
  }, [onClick, isCopied, content, setIsCopied, delay]);

  const state = isCopied ? 'copied' : failed ? 'error' : 'idle';
  const Icon = failed ? XIcon : CopyIcon;
  const label = isCopied ? 'Copied!' : failed ? 'Copy failed. Try again.' : accessibleLabel;
  const visibleLabel = isCopied ? 'Copied' : failed ? 'Retry' : 'Copy';

  return <ButtonPrimitive
    type="button"
    {...props}
    data-slot="copy-button"
    data-state={state}
    data-variant={variant}
    data-size={size}
    className={['animate-copy-button', className].filter(Boolean).join(' ')}
    onClick={handleCopy}
    aria-label={label}
    title={state === 'idle' ? title || accessibleLabel : label}
  >
    <span className="copy-button-icon" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span
          key={state}
          data-slot="copy-button-icon"
          initial={reducedMotion ? false : { scale: 0.6, opacity: 0, rotate: -30, filter: 'blur(3px)' }}
          animate={{ scale: 1, opacity: 1, rotate: 0, filter: 'blur(0px)' }}
          exit={reducedMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0, rotate: 30, filter: 'blur(3px)' }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >
          {isCopied ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <motion.path
              d="m5 12 4 4L19 6"
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.25, delay: reducedMotion ? 0 : 0.08 }}
            />
          </svg> : <Icon size={16} strokeWidth={1.75} />}
        </motion.span>
      </AnimatePresence>
    </span>
    {size !== 'icon' && <span className="copy-button-label" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span
          key={state}
          initial={reducedMotion ? false : { y: 7, opacity: 0, filter: 'blur(2px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={reducedMotion ? { opacity: 0 } : { y: -7, opacity: 0, filter: 'blur(2px)' }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >{visibleLabel}</motion.span>
      </AnimatePresence>
    </span>}
    <span className="copy-button-status" role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
      {isCopied ? 'Copied to clipboard.' : failed ? 'Copy failed. Try again.' : ''}
    </span>
  </ButtonPrimitive>;
}

export { CopyButton, type CopyButtonProps };
