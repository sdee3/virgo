/**
 * Resolves the best card image URL for the current display.
 *
 * High-DPR screens (most phones, retina laptops) get the @2x asset so the
 * canvas backing store is fed enough pixels to stay crisp; 1x displays keep
 * the smaller original to avoid wasting bandwidth.
 */
export function cardSrc(file: string): string {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  return dpr > 1.5 ? `/cards/2x/${file}` : `/cards/${file}`
}
