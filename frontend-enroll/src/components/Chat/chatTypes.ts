export type ChatUserRole = 'admin' | 'head_of_school' | 'teacher' | 'student' | 'parent';

export interface QuickReplyChip {
  label: string;
  value: string;
  icon?: string;
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

export type ChatMessageUnion =
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
  type: 'text' | 'card' | 'list' | 'chart' | 'error';
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
