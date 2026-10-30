export type ChatUserRole = 'admin' | 'head_of_school' | 'teacher' | 'student' | 'parent';

export interface QuickReplyChip {
  label: string;
  value: string;
  icon?: string;
  /** Run this instead of sending `value` as a message (menu questions, retries) */
  onSelect?: () => void;
}

// ── Menu (served by GET /api/chat/menu) ─────────────────────────────────────

export interface MenuOption {
  label: string;
  value: string;
  /** Extra skill parameters this answer sets */
  params?: Record<string, string>;
}

export interface MenuStep {
  id: string;
  kind: 'choice' | 'date' | 'instrument' | 'teacher' | 'student' | 'text';
  /** The skill parameter this answer fills; null for a step that only steers later steps */
  param: string | null;
  prompt: string;
  options?: MenuOption[];
  /** Ask only when earlier answers match, e.g. { scope: 'instrument' } */
  when?: Record<string, string>;
}

export interface MenuItem {
  id: string;
  label: string;
  skill: string;
  type?: 'guide';
  /** What to say for a guide option */
  guide?: string;
  group?: string;
  params?: Record<string, string>;
  ask?: MenuStep[];
}

export interface MenuArea {
  id: string;
  label: string;
  icon: string;
  items: MenuItem[];
}

export interface MenuData {
  areas: MenuArea[];
  options: { instruments: string[]; teachers: string[] };
}

interface BaseMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  sessionId: string;
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  text: string;
}

export interface CardMessage extends BaseMessage {
  type: 'card';
  title: string;
  subtitle?: string;
  fields: Array<{ label: string; value: string | number; highlight?: boolean }>;
  actions?: QuickReplyChip[];
}

export interface ListMessage extends BaseMessage {
  type: 'list';
  heading: string;
  items: Array<{ primary: string; secondary?: string; value: string }>;
}

export interface ConfirmMessage extends BaseMessage {
  type: 'confirm';
  summary: string;
  fields: Array<{ label: string; value: string }>;
  actionId: string;
}

export interface AttendancePickerMessage extends BaseMessage {
  type: 'attendance-picker';
  batchId: string;
  batchLabel: string;
  sessionDate: string;
  students: AttendancePickerStudent[];
}

export interface NudgeMessage extends BaseMessage {
  type: 'nudge';
  nudgeId: string;
  text: string;
  actionHint: string;
  dismissed: boolean;
}

export interface ChartSeries {
  key: string;
  color: string;
  label: string;
}

export interface ChartMessage extends BaseMessage {
  type: 'chart';
  title: string;
  chartType: 'bar' | 'line' | 'pie';
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
}

export interface AttendanceRollMessage extends BaseMessage {
  type: 'attendance_roll';
  title: string;
  date: string;
  editable: boolean;
  groups: Array<{
    batch_id: string;
    label: string;
    students: Array<{ student_id: string; name: string; status: 'present' | 'absent' | 'excused' | null; is_guest?: boolean }>;
  }>;
}

export interface AttendanceHistoryMessage extends BaseMessage {
  type: 'attendance_history';
  title: string;
  studentId: string;
  rows: Array<{
    batch_id: string; date: string; day: string; label: string;
    status: 'present' | 'absent' | 'excused' | null; editable: boolean;
  }>;
}

export type ChatMessageUnion =
  | AttendanceRollMessage
  | AttendanceHistoryMessage
  | TextMessage
  | CardMessage
  | ListMessage
  | ConfirmMessage
  | AttendancePickerMessage
  | NudgeMessage
  | ChartMessage;

export interface AttendancePickerStudent {
  student_id: string;
  student_name: string;
  classes_remaining: number;
  current_status: 'present' | 'absent' | null;
}

export interface AttendancePickerResult {
  batchId: string;
  sessionDate: string;
  attendance: Array<{ student_id: string; status: 'present' | 'absent' }>;
}

export interface ChatSession {
  sessionId: string;
  userRole: ChatUserRole;
  userEmail: string;
  messages: ChatMessageUnion[];
  chips: QuickReplyChip[];
  createdAt: string;
  lastActivityAt: string;
}

export interface ChatRequest {
  session_id: string | null;
  message: string;
}

export interface BotApiResponse {
  session_id: string;
  type: 'text' | 'card' | 'list' | 'chart' | 'error' | 'attendance_roll' | 'attendance_history';
  text: string;
  suggestions: string[];
  card: Record<string, unknown> | null;
}

const DEFAULT_CHIPS: Record<ChatUserRole, QuickReplyChip[]> = {
  admin: [
    { label: "Today's attendance", value: "Show me today's attendance summary",                    icon: '📋' },
    { label: 'Finance summary',    value: 'Give me this month finance summary',                    icon: '💰' },
    { label: 'Student turnover',   value: 'Show me student turnover this month vs last month',     icon: '📊' },
    { label: 'Low credits',        value: 'Who has overdue payments?',                             icon: '⚠️'  },
  ],
  head_of_school: [
    { label: "Today's attendance", value: "Show me today's attendance summary",              icon: '📋' },
    { label: 'Overdue fees',       value: 'Who has overdue payments?',                         icon: '⚠️'  },
    { label: 'Student turnover',   value: 'Show me student turnover this month vs last month', icon: '📊' },
    { label: 'Active students',    value: 'List active students',                              icon: '👥' },
  ],
  teacher: [
    { label: 'Class schedule',    value: 'Show the schedule for Keyboard',                       icon: '📅' },
    { label: 'Get class list',    value: 'Get all students for Keyboard for date today',         icon: '👥' },
    { label: 'Mark all present',  value: 'Mark all present',                                     icon: '✅' },
  ],
  student: [
    { label: 'My classes',        value: 'How many classes do I have left?', icon: '🎵' },
    { label: 'Next class',        value: 'When is my next class?',           icon: '📅' },
    { label: 'Attendance record', value: 'Show my attendance this month',    icon: '📋' },
    { label: 'Payment history',   value: 'Show my payment history',          icon: '🧾' },
  ],
  parent: [
    { label: 'My classes',        value: 'How many classes does my child have left?', icon: '🎵' },
    { label: 'Next class',        value: 'When is the next class?',                   icon: '📅' },
    { label: 'Attendance record', value: 'Show attendance this month',                icon: '📋' },
    { label: 'Payment history',   value: 'Show payment history',                      icon: '🧾' },
  ],
};

export function getRoleDefaultChips(role: ChatUserRole): QuickReplyChip[] {
  return DEFAULT_CHIPS[role] ?? DEFAULT_CHIPS.parent;
}
