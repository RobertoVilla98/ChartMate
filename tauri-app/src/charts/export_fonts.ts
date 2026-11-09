/** Font handling for exported figures (pure functions, unit-tested in tests/review_defects.test.ts). */

export type FontCategory = 'sans' | 'serif' | 'mono';

/** Category of a CSS font-family list: monospace, serif or sans-serif. */
export function fontCategory(family: string): FontCategory {
  const f = family.toLowerCase();
  if (/mono|courier|consol/.test(f)) return 'mono';
  if (/times|georgia|garamond|cambria|serif/.test(f) && !/sans/.test(f)) return 'serif';
  return 'sans';
}

const STANDARD_FONTS: Record<'pdf' | 'svg', Record<FontCategory, string>> = {
  // PDF standard-14 fonts: present in every PDF reader, no embedding needed.
  pdf: { sans: 'Helvetica', serif: 'Times', mono: 'Courier' },
  // Fonts installed on every desktop system, with generic fallbacks.
  svg: { sans: 'Arial, Helvetica, sans-serif', serif: "'Times New Roman', Times, serif", mono: "'Courier New', Courier, monospace" }
};

/**
 * Sets every text element of an exported figure in one standard font, chosen from the category of
 * the figure font set by the user (sans-serif by default). Tick labels and annotations, which the
 * interface draws in a monospace face, therefore follow the user's font in exported files.
 */
export function standardizeFontsFor(svg: string, target: 'pdf' | 'svg', userFamily: string): string {
  const std = STANDARD_FONTS[target][fontCategory(userFamily || 'sans-serif')];
  return svg
    .replace(/font-family:\s*([^;"]+)/g, () => `font-family: ${std}`)
    .replace(/font-family="[^"]*"/g, () => `font-family="${std.replace(/"/g, "'")}"`);
}

