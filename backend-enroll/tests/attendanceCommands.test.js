'use strict';

// Pure-function tests — db is mocked so nothing touches a database
jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));

const {
  parseDate, parseTime, parseListCommand, parseMarkCommand, matchNames, planChanges, findContext,
} = require('../llm/attendanceCommands');

const TODAY = '2026-10-28'; // a Wednesday

describe('parseDate', () => {
  it.each([
    ['today', '2026-10-28'],
    ['Yesterday', '2026-10-27'],
    ['tomorrow', '2026-10-29'],
    ['2026-10-05', '2026-10-05'],
    ['28/10', '2026-10-28'],
    ['5-11-2026', '2026-11-05'],
    ['5/11/26', '2026-11-05'],
    ['28 Oct', '2026-10-28'],
    ['28th October 2025', '2025-10-28'],
    ['Oct 3', '2026-10-03'],
    ['tuesday', '2026-10-27'],
    ['wed', '2026-10-28'],
    ['last wednesday', '2026-10-21'],
  ])('%s → %s', (input, expected) => {
    expect(parseDate(input, TODAY)).toBe(expected);
  });

  it.each(['31/02', 'someday', '13/13/2026', 'octember 3', 'thurs-ish'])('rejects %s', (input) => {
    expect(parseDate(input, TODAY)).toBeNull();
  });
});

describe('parseTime', () => {
  it('reads am/pm and 24h times, defaulting small hours to afternoon', () => {
    expect(parseTime('5pm')).toEqual({ hour: 17, minute: null });
    expect(parseTime('17:30')).toEqual({ hour: 17, minute: 30 });
    expect(parseTime('5')).toEqual({ hour: 17, minute: null });
    expect(parseTime('10am')).toEqual({ hour: 10, minute: null });
    expect(parseTime('noonish')).toBeNull();
  });
});

describe('parseListCommand', () => {
  it('parses the documented form', () => {
    expect(parseListCommand('Get all students for Keyboard for date 28/10')).toEqual({
      instrumentText: 'Keyboard', dateText: '28/10', time: null, teacher: null,
    });
  });

  it('handles multi-word instruments and variations', () => {
    expect(parseListCommand('show students in Hindustani Vocals on yesterday?')).toMatchObject({
      instrumentText: 'Hindustani Vocals', dateText: 'yesterday',
    });
  });

  it('defaults the date to today', () => {
    expect(parseListCommand('list students for guitar')).toMatchObject({ instrumentText: 'guitar', dateText: 'today' });
  });

  it('extracts time and teacher filters in either order', () => {
    expect(parseListCommand('get students for keyboard for today at 5pm teacher Mriganka'))
      .toMatchObject({ instrumentText: 'keyboard', dateText: 'today', time: '5pm', teacher: 'Mriganka' });
    expect(parseListCommand('get students for keyboard for today teacher Mriganka at 17:00'))
      .toMatchObject({ dateText: 'today', time: '17:00', teacher: 'Mriganka' });
    expect(parseListCommand('get students for keyboard at 6pm'))
      .toMatchObject({ instrumentText: 'keyboard', dateText: 'today', time: '6pm' });
  });

  it('ignores unrelated messages', () => {
    expect(parseListCommand('How many students do we have?')).toBeNull();
    expect(parseListCommand("Show me today's attendance summary")).toBeNull();
  });
});

describe('parseMarkCommand', () => {
  it('parses the documented form', () => {
    expect(parseMarkCommand('Set students Riya, Arjun as absent and rest as present')).toEqual({
      all: false, names: ['Riya', 'Arjun'], status: 'absent', restStatus: 'present',
    });
  });

  it('splits names on commas, "and" and &', () => {
    expect(parseMarkCommand('set Riya and Arjun & Kabir absent, rest present').names).toEqual(['Riya', 'Arjun', 'Kabir']);
  });

  it('handles "all" and "all … except"', () => {
    expect(parseMarkCommand('Set all present')).toEqual({ all: true, names: [], status: 'present', restStatus: null });
    expect(parseMarkCommand('set all students as absent')).toMatchObject({ all: true, status: 'absent' });
    expect(parseMarkCommand('Mark all present except Riya and Arjun')).toEqual({
      all: false, names: ['Riya', 'Arjun'], status: 'absent', restStatus: 'present',
    });
  });

  it('marks only the named students when there is no "rest" clause', () => {
    expect(parseMarkCommand('Set students Riya as excused')).toEqual({
      all: false, names: ['Riya'], status: 'excused', restStatus: null,
    });
  });

  it('flags commands it cannot read instead of guessing', () => {
    expect(parseMarkCommand('set Riya absent because she was ill')).toEqual({ invalid: true });
    expect(parseMarkCommand('mark all excused except Riya')).toEqual({ invalid: true });
  });

  it('ignores unrelated messages', () => {
    expect(parseMarkCommand('I want to mark attendance for my class')).toBeNull();
    expect(parseMarkCommand('Show me the present students')).toBeNull();
  });
});

describe('matchNames', () => {
  const entries = [
    { student_id: 's1', student_name: 'Riya Sharma', time_slot: '17:00-18:00' },
    { student_id: 's2', student_name: 'Riya Kapoor', time_slot: '18:00-19:00' },
    { student_id: 's3', student_name: 'Arjun Mehta', time_slot: '17:00-18:00' },
    { student_id: 's4', student_name: 'Kabir Rao', time_slot: '17:00-18:00' },
    { student_id: 's4', student_name: 'Kabir Rao', time_slot: '18:00-19:00' }, // same student, two classes
  ];

  it('matches unique first names case-insensitively', () => {
    const r = matchNames(['arjun', 'KABIR'], entries);
    expect([...r.matchedIds]).toEqual(['s3', 's4']);
    expect(r.unmatched).toEqual([]);
    expect(r.ambiguous).toEqual([]);
  });

  it('reports ambiguous first names with their class times', () => {
    const r = matchNames(['Riya'], entries);
    expect(r.ambiguous).toEqual([{ name: 'Riya', options: ['Riya Sharma (17:00-18:00)', 'Riya Kapoor (18:00-19:00)'] }]);
  });

  it('resolves ambiguity with a fuller name', () => {
    expect([...matchNames(['Riya K'], entries).matchedIds]).toEqual(['s2']);
    expect([...matchNames(['riya sharma'], entries).matchedIds]).toEqual(['s1']);
  });

  it('suggests close spellings for unknown names', () => {
    expect(matchNames(['Arjn'], entries).unmatched).toEqual([{ name: 'Arjn', suggestions: ['Arjun Mehta'] }]);
    expect(matchNames(['Zoe'], entries).unmatched).toEqual([{ name: 'Zoe', suggestions: [] }]);
  });
});

describe('planChanges', () => {
  const entries = [
    { batch_id: 'b1', student_id: 's1', status: null },
    { batch_id: 'b1', student_id: 's2', status: 'present' },
    { batch_id: 'b2', student_id: 's3', status: 'present' },
  ];

  it('applies the named status and the rest status, skipping unchanged rows', () => {
    const changes = planChanges(entries, { all: false, status: 'absent', restStatus: 'present' }, new Set(['s2']));
    expect(changes.map(c => [c.entry.student_id, c.status])).toEqual([['s1', 'present'], ['s2', 'absent']]);
  });

  it('leaves others untouched without a rest status', () => {
    const changes = planChanges(entries, { all: false, status: 'excused', restStatus: null }, new Set(['s3']));
    expect(changes.map(c => [c.entry.student_id, c.status])).toEqual([['s3', 'excused']]);
  });

  it('marks everyone for "all"', () => {
    expect(planChanges(entries, { all: true, status: 'present', restStatus: null }, new Set())).toHaveLength(1);
  });
});

describe('findContext', () => {
  const ctx = { date: '2026-10-28', instrument_id: 'i1', instrument_name: 'Keyboard', batch_ids: ['b1'] };
  const reply = (card) => ({ role: 'assistant', content: JSON.stringify({ type: 'list', text: '', card }) });

  it('returns the most recent attendance context', () => {
    const older = { ...ctx, date: '2026-10-27' };
    const history = [reply({ attendance_context: older }), { role: 'user', content: 'hi' }, reply({ attendance_context: ctx })];
    expect(findContext(history)).toEqual(ctx);
  });

  it('returns null when there is none', () => {
    expect(findContext([{ role: 'user', content: 'attendance_context' }, reply({ students: [] })])).toBeNull();
  });
});
