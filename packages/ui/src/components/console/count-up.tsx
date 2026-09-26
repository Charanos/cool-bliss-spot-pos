'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap, isInstant, isReduced, play, vars } from '../../motion/engine';

/** A whole number that counts up from zero on first paint only. metric.count. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-KE'), delayMs = 0 }: { value: number; format?: (n: number) => string; delayMs?: number }) {
  const [shown, setShown] = useState(() => (isInstant() || isReduced() ? value : 0));
  const started = useRef(false);
  useEffect(() => {
    if (started.current || isInstant() || isReduced()) {
      setShown(value);
      return undefined;
    }
    started.current = true;
    const proxy = { n: 0 };
    const animation = play('metric.count', () => gsap.to(proxy, { ...vars('metric.count', { n: value, onUpdate: () => setShown(proxy.n) }), delay: delayMs / 1000 }));
    if (!animation) setShown(value);
    return () => {
      animation?.progress(1).kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first paint only
  }, [value]);
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
