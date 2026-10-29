'use strict';

// Deterministic demo data for evidence runs. Classes are scheduled for *today* so the
// attendance flows have something to act on whatever day the run happens.

const { query } = require('./db');

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const ID = {
  admin: '11111111-1111-1111-1111-111111111111',
  teacher: '22222222-2222-2222-2222-222222222222',
  student: '33333333-3333-3333-3333-333333333333',
  head_of_school: '44444444-4444-4444-4444-444444444444',
};

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function yesterdayIST() {
  const [y, m, d] = todayIST().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

// Same weekday calculation attendanceService uses, so "today's classes" line up.
function todayDayName() {
  return DAY_NAMES[new Date(todayIST() + 'T00:00:00').getDay()];
}

function yesterdayDayName() {
  return DAY_NAMES[new Date(yesterdayIST() + 'T00:00:00').getDay()];
}

async function seed() {
  const dow = todayDayName();
  const yDow = yesterdayDayName();

  const instr = {};
  for (const name of ['Keyboard', 'Guitar']) {
    await query(`INSERT INTO instruments (name, max_batch_size) SELECT $1, 8
                 WHERE NOT EXISTS (SELECT 1 FROM instruments WHERE name = $1)`, [name]);
    instr[name] = (await query('SELECT id FROM instruments WHERE name = $1', [name])).rows[0].id;
  }

  const users = [
    [ID.admin, 'admin@local.dev', 'Local Admin', 'admin'],
    [ID.head_of_school, 'hos@local.dev', 'Local Head of School', 'head_of_school'],
    [ID.teacher, 'teacher@local.dev', 'Local Teacher', 'teacher'],
    [ID.student, 'student@local.dev', 'Local Student', 'student'],
  ];
  for (const [id, email, name, role] of users) {
    await query(`INSERT INTO users (id, google_id, email, name) VALUES ($1, $2, $3, $4)`, [id, `e2e-${role}`, email, name]);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [id, role]);
  }

  const ravi = (await query(`INSERT INTO teachers (name, phone) VALUES ('Ravi Kumar', '+91-9000000001') RETURNING id`)).rows[0].id;
  const anita = (await query(`INSERT INTO teachers (name, phone) VALUES ('Anita Sharma', '+91-9000000002') RETURNING id`)).rows[0].id;
  await query(`INSERT INTO teacher_users (teacher_id, user_id) VALUES ($1, $2)`, [ravi, ID.teacher]);

  const keyboardPkg = (await query(
    `INSERT INTO packages (instrument_id, name, classes_count, price) VALUES ($1, 'Keyboard Quarterly (24)', 24, 5400) RETURNING id`,
    [instr.Keyboard])).rows[0].id;
  const guitarPkg = (await query(
    `INSERT INTO packages (instrument_id, name, classes_count, price) VALUES ($1, 'Guitar Quarterly (24)', 24, 4800) RETURNING id`,
    [instr.Guitar])).rows[0].id;

  const keyboardBatch = (await query(
    `INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity)
     VALUES ($1, $2, $3, '17:00', '18:00', 8) RETURNING id`,
    [instr.Keyboard, ravi, `${yDow} 17:00-18:00, ${dow} 17:00-18:00`])).rows[0].id;
  const guitarBatch = (await query(
    `INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity)
     VALUES ($1, $2, $3, '18:00', '19:00', 8) RETURNING id`,
    [instr.Guitar, anita, `${yDow} 18:00-19:00, ${dow} 18:00-19:00`])).rows[0].id;

  // name, instrument, batch, package, classes remaining
  const roster = [
    ['Priya Singh', 'Keyboard', keyboardBatch, keyboardPkg, 10],
    ['Neha Reddy', 'Keyboard', keyboardBatch, keyboardPkg, 0],
    ['Aisha Khan', 'Keyboard', keyboardBatch, keyboardPkg, 5],
    ['Rohit Desai', 'Guitar', guitarBatch, guitarPkg, 1],
  ];
  const students = {};
  for (const [name, instrument, batch, pkg, remaining] of roster) {
    const sid = (await query(
      `INSERT INTO students (name, phone, guardian_contact) VALUES ($1, $2, $3) RETURNING id`,
      [name, `+91-90100${String(Object.keys(students).length + 10)}`, `Guardian of ${name}`])).rows[0].id;
    students[name] = sid;
    const eid = (await query(
      `INSERT INTO enrollments (student_id, instrument_id, classes_remaining) VALUES ($1, $2, $3) RETURNING id`,
      [sid, instr[instrument], remaining])).rows[0].id;
    await query(`INSERT INTO enrollment_batches (enrollment_id, batch_id, classes_remaining) VALUES ($1, $2, $3)`,
      [eid, batch, remaining]);
    if (remaining > 0) {
      await query(`INSERT INTO payments (student_id, package_id, amount, method) VALUES ($1, $2, $3, 'UPI')`,
        [sid, pkg, instrument === 'Keyboard' ? 5400 : 4800]);
    }
  }

  return { today: todayIST(), yesterday: yesterdayIST(), dow, students, batches: { keyboardBatch, guitarBatch } };
}

module.exports = { seed, ID, todayIST, yesterdayIST };
