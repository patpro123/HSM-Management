jest.mock('../db', () => ({ query: jest.fn() }));

const { recurrenceMatches } = require('../llm/batchSkills');
const { canUseTool, canPropose, canApprove } = require('../auth/actionPermissions');

describe('recurrenceMatches', () => {
  const rec = 'TUE 17:00-18:00, THU 17:00-18:00';

  it('matches a day and a start time', () => {
    expect(recurrenceMatches(rec, 'Thursday 5pm')).toBe(true);
    expect(recurrenceMatches(rec, 'thu 17:00')).toBe(true);
  });

  it('does not treat the end time as a start time', () => {
    expect(recurrenceMatches(rec, 'Thursday 6pm')).toBe(false);
  });

  it('reads a full time range as the class start', () => {
    expect(recurrenceMatches('FRI 17:00-17:45', 'FRI 17:00-17:45')).toBe(true);
    expect(recurrenceMatches('FRI 17:00-17:45', 'Friday 5:45pm')).toBe(false);
  });

  it('rejects a day the batch does not run', () => {
    expect(recurrenceMatches(rec, 'Saturday')).toBe(false);
  });

  it('matches on day alone', () => {
    expect(recurrenceMatches(rec, 'Tuesday')).toBe(true);
  });

  it('needs a day or a time to match anything', () => {
    expect(recurrenceMatches(rec, 'guitar')).toBe(false);
  });
});

describe('batch tool permissions', () => {
  it('lets a teacher look up and request a move, but not create or edit batches', () => {
    expect(canUseTool('teacher', 'batch.find')).toBe(true);
    expect(canPropose('teacher', 'batch.move')).toBe(true);
    expect(canUseTool('teacher', 'batch.create')).toBe(false);
    expect(canUseTool('teacher', 'batch.update')).toBe(false);
  });

  it('lets Head of School propose and approve every batch change', () => {
    for (const a of ['batch.move', 'batch.create', 'batch.update']) {
      expect(canPropose('head_of_school', a)).toBe(true);
      expect(canApprove(['head_of_school'], a)).toBe(true);
    }
  });

  it('keeps parents and students out of batch changes', () => {
    for (const a of ['batch.find', 'batch.move', 'batch.create', 'batch.update']) {
      expect(canUseTool('parent', a)).toBe(false);
    }
  });
});
