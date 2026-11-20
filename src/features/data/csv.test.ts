import { describe, expect, it } from 'vitest';
import { toCSV } from './csv';

describe('toCSV', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCSV([{ a: 'x, y', b: 'say "hi"', c: 'two\nlines' }])).toBe('a,b,c\r\n"x, y","say ""hi""","two\nlines"');
  });

  it('joins arrays, leaves numbers alone and blanks nulls', () => {
    expect(toCSV([{ tags: ['a', 'b'], n: -5, z: null }])).toBe('tags,n,z\r\na; b,-5,');
  });

  it('neutralises spreadsheet formulas in text', () => {
    expect(toCSV([{ t: '=HYPERLINK("x")' }])).toBe('t\r\n"\'=HYPERLINK(""x"")"');
  });

  it('uses the given column order', () => {
    expect(toCSV([{ a: 1, b: 2 }], ['b', 'a'])).toBe('b,a\r\n2,1');
  });
});
