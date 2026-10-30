const { duesItems, fmtDate, money } = require('../llm/dues');

describe('dues formatting', () => {
  it('formats dates and rupees', () => {
    expect(fmtDate('2026-06-28')).toBe('28 Jun 2026');
    expect(fmtDate(null)).toBe('');
    expect(money(7347)).toBe('₹7,347');
  });

  const row = o => ({ student_id: 'a', name: 'Asha', instrument: 'Drums', allowance: 8, used: 3, classes_remaining: 5, overdue_classes: 0,
    pending_amount: 3900, has_payment: true, last_paid_on: '2026-10-01', ...o });

  it('shows what is due, usage since the last payment and when it ran out', () => {
    const [over, soon, none] = duesItems([
      row({ used: 9, classes_remaining: 0, overdue_classes: 1, overdue_since: '2026-10-25' }),
      row({ used: 6, classes_remaining: 2 }),
      row({ has_payment: false, last_paid_on: null, used: 4, allowance: 0 }),
    ]);
    expect(over).toMatchObject({ group: 'Drums', secondary: '₹3,900 due · 9/8 used · ran out 25 Oct 2026' });
    expect(over.action).toEqual({ skill: 'payment.dues_detail', params: { student_id: 'a', instrument: 'Drums' }, label: 'Asha · Drums dues' });
    expect(soon.secondary).toBe('₹3,900 due soon · 6/8 used · 2 left');
    expect(none.secondary).toBe('₹3,900 due · no payment on record · 4 classes attended');
  });
});

describe('payment follow-up message', () => {
  jest.mock('../db', () => ({ query: jest.fn() }));
  const { composeMessage, waLink } = require('../services/whatsappMessages');
  const d = o => ({ instrument: 'Drums', allowance: 8, used: 3, classes_remaining: 5, overdue_classes: 0, pending_amount: 3900,
    last_paid_on: '2026-10-01', ...o });

  it('counts classes since the last payment against the package', () => {
    const text = composeMessage('payment_followup', { studentName: 'Asha', dues: [d({ used: 9, classes_remaining: 0, overdue_classes: 1 })] });
    expect(text).toContain("Asha's Drums classes");
    expect(text).toContain('9 classes attended since the last payment on 1 Oct 2026 (package of 8), so the next payment of ₹3,900 is now due.');
    expect(text.endsWith('- HSM Team')).toBe(true);
  });

  it('asks ahead of time when classes are nearly used', () => {
    const text = composeMessage('payment_followup', { studentName: 'Asha', dues: [d({ used: 6, classes_remaining: 2 })] });
    expect(text).toContain('6 of 8 classes used since the last payment on 1 Oct 2026, 2 left. The next payment of ₹3,900 will be due shortly.');
  });

  it('covers several instruments and a missing payment record', () => {
    const text = composeMessage('payment_followup', { studentName: 'Ravi',
      dues: [d({ used: 6, classes_remaining: 2 }), d({ instrument: 'Guitar', last_paid_on: null, used: 4 })] });
    expect(text).toContain('Drums: 6 of 8');
    expect(text).toContain('Guitar: We have no payment on record yet for the 4 classes attended');
  });

  it('builds a click-to-chat link, adding the country code', () => {
    expect(waLink('98765 43210', 'Hi there')).toBe('https://wa.me/919876543210?text=Hi%20there');
    expect(waLink(null, 'x')).toBe('https://wa.me/?text=x');
  });
});
