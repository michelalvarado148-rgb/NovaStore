'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  ctaLabel: string;
  ctaHref: string;
  meta?: string;
  accent: 'blue' | 'cyan' | 'purple';
};

const ACCENTS: Record<HeroSlide['accent'], string> = {
  blue: 'bg-blue-500/15 text-sky-200 border-sky-400/40',
  cyan: 'bg-cyan-400/15 text-cyan-100 border-cyan-300/40',
  purple: 'bg-purple-500/15 text-fuchsia-100 border-fuchsia-400/40',
};

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;

  const go = useCallback(
    (next: number) => {
      if (total === 0) return;
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (total <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  if (total === 0) return null;
  const current = slides[Math.min(index, total - 1)];

  return (
    <div
      className="hero-banner relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-label="Promociones destacadas de NOVASTORE"
    >
      <div className="relative">
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.id}
              data-active={active}
              aria-hidden={!active}
              className={`slide-shell px-5 pb-16 pt-7 transition-opacity duration-700 sm:px-8 sm:pb-16 sm:pt-9 ${
                active ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
              }`}
            >
              <div className="slide-art">
                {slide.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.imageUrl} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
                ) : null}
              </div>
              <div className="slide-veil" />
              <div className="relative max-w-md">
                <span className={`badge border ${ACCENTS[slide.accent]}`}>{slide.eyebrow}</span>
                <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-[2rem]">
                  {slide.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-300">
                  {slide.subtitle}
                </p>
                {slide.meta ? (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">
                    {slide.meta}
                  </p>
                ) : null}
                <Link href={slide.ctaHref} className="btn btn-primary btn-sm mt-4">
                  {slide.ctaLabel}
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </div>
          );
        })}

        <div className="absolute inset-x-0 bottom-4 flex items-center justify-between gap-3 px-5 sm:px-8">
          <div className="flex items-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Ver banner ${i + 1}: ${slide.eyebrow}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
                className={`dot ${i === index ? 'dot-active' : ''}`}
              />
            ))}
          </div>
          {total > 1 ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Banner anterior"
                onClick={() => go(index - 1)}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/40 text-slate-200 transition hover:border-sky-400/70 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Banner siguiente"
                onClick={() => go(index + 1)}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/40 text-slate-200 transition hover:border-sky-400/70 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {`Banner ${index + 1} de ${total}: ${current.eyebrow}`}
      </p>
    </div>
  );
}
