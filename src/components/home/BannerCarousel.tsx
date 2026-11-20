'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type BannerSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  meta?: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string | null;
  mark?: string;
};

const GAP = 12;

export default function BannerCarousel({ slides }: { slides: BannerSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = slides.length;

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track || total === 0) return;
    const step = track.clientWidth + GAP;
    track.scrollTo({ left: index * step, behavior: 'smooth' });
    setActive(index);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const step = track.clientWidth + GAP;
      if (step <= 0) return;
      const index = Math.round(track.scrollLeft / step);
      setActive(Math.max(0, Math.min(total - 1, index)));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [total]);

  useEffect(() => {
    if (total < 2) return;
    const timer = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const step = track.clientWidth + GAP;
      if (step <= 0) return;
      const current = Math.round(track.scrollLeft / step);
      const next = (current + 1) % total;
      track.scrollTo({ left: next * step, behavior: 'smooth' });
    }, 5200);
    return () => window.clearInterval(timer);
  }, [total]);

  if (total === 0) return null;

  return (
    <div>
      <div className="ns-banners" ref={trackRef} aria-label="Promociones destacadas">
        {slides.map((slide, index) => (
          <article className="ns-banner" key={slide.id} aria-label={slide.title}>
            {slide.imageUrl ? <img src={slide.imageUrl} alt="" loading={index === 0 ? 'eager' : 'lazy'} /> : null}
            <span className="ns-banner-glow" aria-hidden="true" />
            {slide.mark ? (
              <span className="ns-banner-mark" aria-hidden="true">
                {slide.mark}
              </span>
            ) : null}
            <div className="ns-banner-body">
              <span className="ns-banner-eyebrow">{slide.eyebrow}</span>
              <h2 className="ns-banner-title">{slide.title}</h2>
              <p className="ns-banner-sub">{slide.subtitle}</p>
              {slide.meta ? <span className="ns-banner-meta">{slide.meta}</span> : null}
              <Link href={slide.ctaHref} className="ns-banner-cta">
                {slide.ctaLabel}
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </article>
        ))}
      </div>

      {total > 1 ? (
        <div className="ns-dots" role="tablist" aria-label="Seleccionar promoción">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Promoción ${index + 1}`}
              className={`ns-dot ${index === active ? 'is-active' : ''}`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
