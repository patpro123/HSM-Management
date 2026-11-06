const { computeClassesRemaining } = require('../utils/credits');

// computeClassesRemaining runs four queries; the fake pool answers each by a distinctive
// fragment of its SQL.
const DRUMS = { instrument_id: 'i-drums', instrument: 'Drums' };
const GUITAR = { instrument_id: 'i-guitar', instrument: 'Guitar' };

function poolWith({ pkg = [], pkgless = [], attended = [], enrolled = [] }) {
  return {
    query: async (sql) => {
      if (sql.includes('JOIN packages pkg')) return { rows: pkg };
      if (sql.includes('fee_structures')) return { rows: pkgless };
      if (sql.includes('attendance_records')) return { rows: attended };
      if (sql.includes('enrollment_batches')) return { rows: enrolled };
      throw new Error('unexpected query');
    },
  };
}

describe('computeClassesRemaining', () => {
  it('credits a new student who has paid but not attended yet', async () => {
    // Payment carries neither instrument_id nor batch_id: unattributed credits.
    const pool = poolWith({
      pkgless: [{ instrument_id: null, instrument: null, credits: '24' }],
      enrolled: [DRUMS],
    });
    const r = await computeClassesRemaining(pool, 's1');
    expect(r.byInstrument).toEqual({ Drums: 24 });
    expect(r.total).toBe(24);
  });

  it('subtracts attendance from attributed credits', async () => {
    const pool = poolWith({
      pkgless: [{ ...DRUMS, credits: '24' }],
      attended: [{ ...DRUMS, attended: '3' }],
      enrolled: [DRUMS],
    });
    expect((await computeClassesRemaining(pool, 's1')).byInstrument).toEqual({ Drums: 21 });
  });

  it('leaves unattributed credits out of the split when enrolled in several instruments', async () => {
    const pool = poolWith({
      pkgless: [{ instrument_id: null, instrument: null, credits: '8' }],
      enrolled: [DRUMS, GUITAR],
    });
    const r = await computeClassesRemaining(pool, 's1');
    expect(r.byInstrument).toEqual({});
    expect(r.total).toBe(8);
  });

  it('never goes below zero', async () => {
    const pool = poolWith({
      pkgless: [{ ...DRUMS, credits: '4' }],
      attended: [{ ...DRUMS, attended: '9' }],
      enrolled: [DRUMS],
    });
    expect((await computeClassesRemaining(pool, 's1')).byInstrument).toEqual({ Drums: 0 });
  });
});
