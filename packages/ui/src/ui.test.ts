import { describe, expect, it } from 'vitest';
import { cn } from './lib/cn.ts';
import { initials, presenceColour, PRESENCE_COLOURS, readableTextOn } from './components/misc.tsx';

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const ch = (i: number) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('presence colours', () => {
  it('are deterministic per principal', () => {
    expect(presenceColour('u_abc')).toBe(presenceColour('u_abc'));
    expect(PRESENCE_COLOURS).toContain(presenceColour('g_xyz'));
  });

  it('always get avatar initials with ≥ 4.5:1 contrast', () => {
    for (const colour of PRESENCE_COLOURS) {
      expect(contrast(colour, readableTextOn(colour)), colour).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('initials', () => {
  it.each([
    ['Ashutosh Lodha', 'AL'],
    ['Priya', 'P'],
    ['  mei   ling chen ', 'MC'],
    ['', '?'],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('cn', () => {
  it('lets later classes win, including our custom type scale', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
    expect(cn('text-sm', 'text-md')).toBe('text-md');
    // A colour utility must not knock out a font-size utility (custom scale registered).
    expect(cn('text-sm', 'text-accent')).toBe('text-sm text-accent');
  });
});
