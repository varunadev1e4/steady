import { describe, expect, it } from 'vitest';
import { sectionFor } from './navigation';
import { COMMANDS, searchCommands } from './commands';

describe('sectionFor', () => {
  it('keeps the right tab active on sub-pages', () => {
    expect(sectionFor('/', true)).toBe('/');
    expect(sectionFor('/journal/write/abc', true)).toBe('/journal');
    expect(sectionFor('/food/library', true)).toBe('/body');
    expect(sectionFor('/workouts/log/1', false)).toBe('/body');
    expect(sectionFor('/plans/walk/session', true)).toBe('/body');
    expect(sectionFor('/people/1/edit', true)).toBe('/people');
    expect(sectionFor('/habits/1', true)).toBe('/more');
    expect(sectionFor('/goals/weight', true)).toBe('/more');
  });

  it('puts Mind under More on phones, and on its own in the rail', () => {
    expect(sectionFor('/mind/check', true)).toBe('/mind');
    expect(sectionFor('/breathe', true)).toBe('/mind');
    expect(sectionFor('/mind/check', false)).toBe('/more');
  });

  it('does not treat look-alike paths as sections', () => {
    expect(sectionFor('/journals', true)).toBe('/more');
    expect(sectionFor('/bodyweight', true)).toBe('/more');
  });
});

describe('searchCommands', () => {
  it('has no duplicate ids', () => {
    expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(COMMANDS.length);
  });

  it('returns everything for an empty query', () => {
    expect(searchCommands(COMMANDS, '  ')).toHaveLength(COMMANDS.length);
  });

  it('matches keywords, not just labels', () => {
    const ids = searchCommands(COMMANDS, 'blood pressure').map((c) => c.id);
    expect(ids).toContain('/body/health');
  });

  it('needs every word to match, ignoring case', () => {
    expect(searchCommands(COMMANDS, 'WEIGHT goal').map((c) => c.id)).toContain('/goals/weight');
    expect(searchCommands(COMMANDS, 'weight zebra')).toHaveLength(0);
  });

  it('ranks label prefixes first', () => {
    expect(searchCommands(COMMANDS, 'sle')[0].label).toBe('Sleep');
  });
});
