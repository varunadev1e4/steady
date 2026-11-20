import { describe, expect, it } from 'vitest';
import { applyFormat } from './markdownFormat';

describe('applyFormat', () => {
  it('wraps the selection in bold', () => {
    expect(applyFormat('a word here', 2, 6, 'bold')).toEqual({ value: 'a **word** here', start: 4, end: 8 });
  });

  it('inserts placeholder text when nothing is selected', () => {
    expect(applyFormat('', 0, 0, 'italic').value).toBe('_italic text_');
  });

  it('prefixes every selected line, and toggles it off again', () => {
    const on = applyFormat('one\ntwo\nthree', 0, 7, 'list');
    expect(on.value).toBe('- one\n- two\nthree');
    expect(applyFormat(on.value, on.start, on.end, 'list').value).toBe('one\ntwo\nthree');
  });

  it('applies headings to the current line', () => {
    expect(applyFormat('intro\ntitle', 8, 8, 'heading').value).toBe('intro\n## title');
  });
});
