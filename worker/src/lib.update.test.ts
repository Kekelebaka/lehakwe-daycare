import { describe, it, expect } from 'vitest';
import { blankToNull, buildUpdate, constraintMessage, type ColumnMap } from './lib';

const STAFF: ColumnMap = {
  full_name: { kind: 'text', notNull: true },
  email: { kind: 'text' },
  gender: { kind: 'text' },
  basic_salary: { kind: 'number', notNull: true },
  uif_enabled: { kind: 'bool', notNull: true },
  notes: { kind: 'text' },
};

describe('blankToNull', () => {
  it('maps blank and whitespace-only strings to null', () => {
    expect(blankToNull('')).toBeNull();
    expect(blankToNull('   ')).toBeNull();
    expect(blankToNull(undefined)).toBeNull();
    expect(blankToNull(null)).toBeNull();
  });

  it('trims real values and leaves non-strings alone', () => {
    expect(blankToNull('  male  ')).toBe('male');
    expect(blankToNull(0)).toBe(0);
    expect(blankToNull(false)).toBe(false);
  });
});

describe('buildUpdate', () => {
  it('ignores columns the caller did not submit', () => {
    const { sets, values } = buildUpdate(STAFF, { email: 'a@b.co' });
    expect(sets).toEqual(['email = ?']);
    expect(values).toEqual(['a@b.co']);
  });

  // The actual production bug: the staff form posts gender: '' when the select is
  // left on "— Select —". That used to reach SQLite as '' and blow up the CHECK
  // constraint, surfacing as a 500 "Internal error".
  it('writes NULL, never an empty string, for a blank optional field', () => {
    const { sets, values } = buildUpdate(STAFF, { gender: '' });
    expect(sets).toEqual(['gender = ?']);
    expect(values).toEqual([null]);
  });

  it('lets a user genuinely clear a field that had a value', () => {
    const { values } = buildUpdate(STAFF, { notes: '' });
    expect(values).toEqual([null]);
  });

  it('refuses to blank a NOT NULL column, leaving it untouched instead', () => {
    const { sets } = buildUpdate(STAFF, { full_name: '', basic_salary: '', uif_enabled: '' });
    expect(sets).toEqual([]);
  });

  it('coerces numbers and booleans coming in as form strings', () => {
    const { sets, values } = buildUpdate(STAFF, { basic_salary: '4200.50', uif_enabled: 1 });
    expect(sets).toEqual(['basic_salary = ?', 'uif_enabled = ?']);
    expect(values).toEqual([4200.5, 1]);
  });

  it('keeps a legitimate zero rather than treating it as absent', () => {
    const { values } = buildUpdate(STAFF, { basic_salary: 0, uif_enabled: 0 });
    expect(values).toEqual([0, 0]);
  });

  it('drops keys that are not in the whitelist, so a body cannot inject columns', () => {
    const { sets } = buildUpdate(STAFF, { 'centre_id = 1, full_name': 'x', password_hash: 'y' });
    expect(sets).toEqual([]);
  });

  it('emits a full staff form the way the manager app sends it', () => {
    const { sets, values } = buildUpdate(STAFF, {
      full_name: 'Keke Lebaka', email: '', gender: '', basic_salary: 100, uif_enabled: 1, notes: 'ok',
    });
    expect(sets).toEqual(['full_name = ?', 'email = ?', 'gender = ?', 'basic_salary = ?', 'uif_enabled = ?', 'notes = ?']);
    expect(values).toEqual(['Keke Lebaka', null, null, 100, 1, 'ok']);
  });
});

describe('constraintMessage', () => {
  it('names the field and the allowed values for a CHECK failure', () => {
    const err = new Error("CHECK constraint failed: gender IN ('male', 'female'): SQLITE_CONSTRAINT");
    expect(constraintMessage(err)).toBe('"gender" must be one of: male, female.');
  });

  it('handles NOT NULL and UNIQUE failures', () => {
    expect(constraintMessage(new Error('NOT NULL constraint failed: staff.full_name'))).toBe('"full_name" is required.');
    expect(constraintMessage(new Error('UNIQUE constraint failed: users.email'))).toBe('That "email" is already in use.');
  });

  it('returns null for an unrelated error so it still reports as a 500', () => {
    expect(constraintMessage(new Error('boom'))).toBeNull();
  });
});
