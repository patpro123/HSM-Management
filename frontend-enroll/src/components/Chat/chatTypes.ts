export type ChatUserRole = 'admin' | 'teacher' | 'student' | 'parent';

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

export type ChatMessageUnion =
  | TextMessage
  | CardMessage
  | ListMessage
  | ConfirmMessage
  | AttendancePickerMessage
  | NudgeMessage;

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
  type: 'text' | 'card' | 'list' | 'error';
  text: string;
  suggestions: string[];
  card: Record<string, unknown> | null;
}

const DEFAULT_CHIPS: Record<ChatUserRole, QuickReplyChip[]> = {
  admin: [
    { label: "Today's attendance", value: "Show me today's attendance summary", icon: '📋' },
    { label: 'Enroll student',     value: 'I want to enroll a new student',      icon: '➕' },
    { label: 'Payment status',     value: 'Who has overdue payments?',            icon: '💰' },
    { label: 'Stats overview',     value: 'Give me a quick stats overview',       icon: '📊' },
  ],
  teacher: [
    { label: 'My batches today',  value: 'Which of my batches are today?',          icon: '📅' },
    { label: 'Mark attendance',   value: 'I want to mark attendance for my class',  icon: '✅' },
    { label: 'My students',       value: 'Show me my current students',             icon: '👥' },
    { label: 'My payout',         value: 'What is my projected payout this month?', icon: '💵' },
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
