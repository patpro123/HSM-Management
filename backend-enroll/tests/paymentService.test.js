const { recordPayment } = require('../services/paymentService');

jest.mock('../services/receiptService', () => ({ assignReceiptNumber: async () => 'R-1' }));

const DRUMS = 'i-drums';
const GUITAR = 'i-guitar';

// A fake transaction client. Each query is answered by a distinctive fragment of its SQL; the
// payment INSERT is captured so tests can read the stored metadata.
function fakeClient({ packages = {}, feeStructures = {}, batches = {}, enrolled = [], instruments = [DRUMS, GUITAR] } = {}) {
  const inserted = [];
  return {
    inserted,
    query: async (sql, params = []) => {
      if (sql.includes('FROM packages')) return { rows: packages[params[0]] ? [{ id: params[0], ...packages[params[0]] }] : [] };
      if (sql.includes('FROM fee_structures')) return { rows: feeStructures[params[0]] ? [{ id: params[0], ...feeStructures[params[0]] }] : [] };
      if (sql.includes('SELECT instrument_id FROM batches')) return { rows: batches[params[0]] ? [{ instrument_id: batches[params[0]] }] : [] };
      if (sql.includes('FROM instruments')) return { rows: instruments.includes(params[0]) ? [{ id: params[0] }] : [] };
      if (sql.includes('SELECT DISTINCT b.instrument_id')) return { rows: enrolled.map(instrument_id => ({ instrument_id })) };
      if (sql.includes('SELECT eb.batch_id')) return { rows: [] };
      if (sql.includes('INSERT INTO payments')) {
        const row = { id: 'p1', timestamp: new Date(), amount: params[2], metadata: JSON.parse(params[4]), package_id: params[1] };
        inserted.push(row);
        return { rows: [row] };
      }
      return { rows: [] }; // students / enrollment_batches updates
    },
  };
}

describe('recordPayment instrument and credits', () => {
  it('stores the instrument of the selected batch', async () => {
    const c = fakeClient({ batches: { b1: DRUMS } });
    await recordPayment(c, { student_id: 's1', amount: 8550, class_credits: 24, batch_id: 'b1' }, 'u1');
    expect(c.inserted[0].metadata).toMatchObject({ instrument_id: DRUMS, credits_bought: 24, batch_id: 'b1' });
  });

  it('takes credits and instrument from the package when the caller sends neither (chat)', async () => {
    const c = fakeClient({ packages: { pk1: { classes_count: 8, instrument_id: GUITAR } } });
    await recordPayment(c, { student_id: 's1', amount: 2500, package_id: 'pk1' }, 'u1');
    expect(c.inserted[0].metadata).toMatchObject({ instrument_id: GUITAR, credits_bought: 8 });
    expect(c.inserted[0].package_id).toBe('pk1');
  });

  it('keeps a fee-structure id in metadata and still resolves its credits and instrument', async () => {
    const c = fakeClient({ feeStructures: { fs1: { classes_count: 24, instrument_id: DRUMS } } });
    await recordPayment(c, { student_id: 's1', amount: 10500, package_id: 'fs1' }, 'u1');
    expect(c.inserted[0].package_id).toBeNull();
    expect(c.inserted[0].metadata).toMatchObject({ fee_structure_id: 'fs1', instrument_id: DRUMS, credits_bought: 24 });
  });

  it('respects an explicit credit count of 0', async () => {
    const c = fakeClient({ packages: { pk1: { classes_count: 8, instrument_id: GUITAR } } });
    await recordPayment(c, { student_id: 's1', amount: 500, package_id: 'pk1', class_credits: 0 }, 'u1');
    expect(c.inserted[0].metadata.credits_bought).toBe(0);
  });

  it("falls back to the student's single enrolled instrument", async () => {
    const c = fakeClient({ enrolled: [DRUMS] });
    await recordPayment(c, { student_id: 's1', amount: 8550, class_credits: 24 }, 'u1');
    expect(c.inserted[0].metadata.instrument_id).toBe(DRUMS);
  });

  it('rejects credits it cannot attribute to an instrument', async () => {
    const c = fakeClient({ enrolled: [DRUMS, GUITAR] });
    await expect(recordPayment(c, { student_id: 's1', amount: 8550, class_credits: 24 }, 'u1'))
      .rejects.toMatchObject({ status: 400 });
    expect(c.inserted).toHaveLength(0);
  });

  it('still records a no-credit payment with no instrument', async () => {
    const c = fakeClient({ enrolled: [DRUMS, GUITAR] });
    await recordPayment(c, { student_id: 's1', amount: 500, class_credits: 0 }, 'u1');
    expect(c.inserted[0].metadata.instrument_id).toBeUndefined();
  });
});
