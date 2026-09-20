'use client';

import type { ReactNode } from 'react';
import type { Icon as TablerIcon } from '@tabler/icons-react';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';

export interface SettingsRowProps {
  label: string;
  value: ReactNode;
  helper?: string;
  icon?: TablerIcon;
  className?: string;
}

/**
 * Clean key-value telemetry row for Floor Settings panels.
 * Strictly adheres to bliss/max-font-weight (no bold/semibold).
 */
export function SettingsRow({ label, value, helper, icon: Icon, className }: SettingsRowProps) {
  return (
    <div
      className={cx(
        'flex items-center justify-between gap-16 py-12 tablet:py-16 border-b border-rule-raised/20 last:border-b-0 min-h-[44px]',
        className,
      )}
    >
      <div className="flex items-center gap-12 min-w-0">
        {Icon ? (
          <Icon size={16} stroke={ICON_STROKE} className="text-ink-muted shrink-0" />
        ) : null}
        <div className="flex flex-col min-w-0">
          <span className="text-body-sm font-medium text-ink-subtle truncate">{label}</span>
          {helper ? (
            <span className="font-mono text-micro text-ink-disabled truncate">{helper}</span>
          ) : null}
        </div>
      </div>

      <div className="text-right text-body font-medium text-ink shrink-0">{value}</div>
    </div>
  );
}
