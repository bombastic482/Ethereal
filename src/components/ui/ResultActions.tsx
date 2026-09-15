import { useState } from 'preact/hooks';
import { Icon } from './Icon';

interface Props {
  /** Plain-text summary to copy to the clipboard. */
  summary: string;
  onReset?: () => void;
}

export function ResultActions({ summary, onReset }: Props) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; nothing else to do */
    }
  };
  return (
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn btn-secondary text-sm" onClick={copy} aria-live="polite">
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? 'Copied' : 'Copy results'}
      </button>
      <button type="button" class="btn btn-secondary text-sm" onClick={() => window.print()}>
        Print
      </button>
      {onReset && (
        <button type="button" class="btn btn-ghost text-sm" onClick={onReset}>
          <Icon name="reset" size={16} />
          Reset
        </button>
      )}
    </div>
  );
}
