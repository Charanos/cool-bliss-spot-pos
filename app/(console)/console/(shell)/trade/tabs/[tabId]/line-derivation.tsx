import type { DerivationStep } from '@bliss/shared/domain';
import { type Cents, formatFigure } from '@bliss/shared/money';
import { IconChevronRight } from '@tabler/icons-react';

/**
 * The stored price derivation as an ordered chain, docs/01 R4. It is read back from the line, never
 * recomputed: a happy hour price fired at 18:59:59 still reads as happy hour here tomorrow.
 * A native disclosure, so it works before hydration and with every assistive technology.
 */
export function LineDerivation({ steps, unit }: { steps: readonly DerivationStep[]; unit: Cents }) {
  if (steps.length === 0) return null;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-4 rounded-sm text-body-sm text-ink-subtle transition-hover hover:text-ink [&::-webkit-details-marker]:hidden">
        <IconChevronRight size={14} stroke={1.5} aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        How the price was set, <span className="font-mono tabular text-num-sm">{formatFigure(unit)}</span> each
      </summary>
      <ol className="mt-8 flex flex-col border-l border-rule" aria-label="Price derivation, in order">
        {steps.map((step, i) => (
          <li key={`${step.label}-${i}`} className="grid grid-cols-[24px_minmax(120px,1fr)_auto] items-baseline gap-12 py-4 pl-12">
            <span className="font-mono tabular text-num-sm text-ink-subtle">{i + 1}</span>
            <span className="text-body-sm text-ink">{step.label}</span>
            <span className="whitespace-nowrap text-right font-mono tabular text-num-sm text-ink-muted">
              {step.input} <span className="text-ink-subtle">{step.op}</span> <span aria-hidden="true">→</span>
              <span className="sr-only">gives</span> <span className="text-ink">{step.output}</span>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
