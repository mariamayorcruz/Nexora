'use client';

import { useEffect, useRef, useState } from 'react';

type RevealOnScrollProps = {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  durationMs?: number;
  distancePx?: number;
};

export default function RevealOnScroll({
  children,
  className = '',
  delayMs = 0,
  durationMs = 760,
  distancePx = 36,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [visible]);

  const style = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translate3d(0, 0, 0) scale(1)' : `translate3d(0, ${distancePx}px, 0) scale(0.98)`,
    filter: visible ? 'blur(0px)' : 'blur(6px)',
    transitionProperty: 'opacity, transform, filter',
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    transitionDelay: `${delayMs}ms`,
    willChange: 'opacity, transform, filter',
  } as const;

  return (
    <div
      ref={ref}
      className={`reveal-up ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
