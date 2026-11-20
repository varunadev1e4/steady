import { describe, expect, it } from 'vitest';
import { readImportFile } from './exportImport';

const file = (content: unknown) =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], 'export.json', { type: 'application/json' });

const valid = {
  app: 'steady',
  version: 1,
  exported_at: '2026-11-20T10:00:00Z',
  profile: { units: 'kg' },
  tables: {
    habits: [{ id: '6f1c3a52-6a37-4c3f-9d2e-1c5a3b7d9e01', name: 'Walk' }],
    notes: [],
  },
};

describe('readImportFile', () => {
  it('accepts a Steady export and counts rows per table', async () => {
    const p = await readImportFile(file(valid));
    expect(p.counts).toEqual([{ table: 'habits', rows: 1 }]);
  });

  it('rejects non-JSON', async () => {
    await expect(readImportFile(file('not json'))).rejects.toThrow('valid JSON');
  });

  it('rejects files from other apps', async () => {
    await expect(readImportFile(file({ ...valid, app: 'other' }))).rejects.toThrow('Steady export');
  });

  it('rejects unknown tables and rows without a valid id', async () => {
    await expect(readImportFile(file({ ...valid, tables: { secrets: [] } }))).rejects.toThrow();
    await expect(readImportFile(file({ ...valid, tables: { habits: [{ id: 'x' }] } }))).rejects.toThrow('tables.habits.0.id');
  });
});
