export type FormatKind = 'bold' | 'italic' | 'heading' | 'list' | 'quote';

/**
 * Applies a Markdown format to the selected text of a textarea value.
 * Returns the new value and the selection to restore.
 */
export function applyFormat(
  value: string,
  start: number,
  end: number,
  kind: FormatKind,
): { value: string; start: number; end: number } {
  if (kind === 'bold' || kind === 'italic') {
    const mark = kind === 'bold' ? '**' : '_';
    const selected = value.slice(start, end) || (kind === 'bold' ? 'bold text' : 'italic text');
    const next = `${value.slice(0, start)}${mark}${selected}${mark}${value.slice(end)}`;
    return { value: next, start: start + mark.length, end: start + mark.length + selected.length };
  }
  const prefix = kind === 'heading' ? '## ' : kind === 'list' ? '- ' : '> ';
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = value.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allPrefixed = lines.every((l) => l.startsWith(prefix));
  const changed = lines.map((l) => (allPrefixed ? l.slice(prefix.length) : l.startsWith(prefix) ? l : prefix + l)).join('\n');
  const next = value.slice(0, lineStart) + changed + value.slice(lineEnd);
  return { value: next, start: lineStart, end: lineStart + changed.length };
}
