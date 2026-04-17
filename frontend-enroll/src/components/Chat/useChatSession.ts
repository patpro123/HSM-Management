import { useState, useCallback, useRef, useEffect } from 'react';
import { apiPost } from '../../api';
import {
  ChatMessageUnion, ChatUserRole, QuickReplyChip, AttendancePickerResult,
  getRoleDefaultChips, TextMessage,
} from './chatTypes';

interface BotApiResponse {
  session_id: string;
  type: string;
  text: string;
  suggestions: string[];
  card: Record<string, unknown> | null;
}

function botResponseToMessage(resp: BotApiResponse): ChatMessageUnion {
  const base = {
    id: crypto.randomUUID(),
    sender: 'bot' as const,
    timestamp: new Date().toISOString(),
    sessionId: resp.session_id,
  };

  const card = resp.card ?? {};

  switch (resp.type) {
    case 'list': {
      // card.students / card.roster / card.payments / card.report — normalize to items[]
      const rawItems: Record<string, unknown>[] =
        (card.students ?? card.roster ?? card.payments ?? card.report ?? card.items ?? []) as Record<string, unknown>[];
      if (!rawItems.length) {
        return { ...base, type: 'text', text: resp.text || 'No results found.' };
      }
      const items = rawItems.map(item => ({
        primary:   String(item.name ?? item.instrument ?? item.package ?? item.teacher ?? item.label ?? ''),
        secondary: item.classes_remaining != null
          ? `${item.classes_remaining} classes remaining`
          : item.amount != null
          ? `₹${item.amount}`
          : item.present != null
          ? `${item.present}/${item.total} present`
          : undefined,
        value: String(item.id ?? item.student_id ?? item.name ?? ''),
      }));
      return { ...base, type: 'list', heading: resp.text, items };
    }

    case 'card': {
      // card.student / card.teacher / card.batch / card.credits / card.packages / card.revenue
      const entity = (card.student ?? card.teacher ?? card.batch ?? card.revenue ?? {}) as Record<string, unknown>;
      const credits = card.credits as Record<string, unknown>[] | undefined;
      const packages = card.packages as Record<string, unknown>[] | undefined;
      const fields = credits
        ? credits.map(c => ({ label: c.recurrence ? `${c.instrument} (${c.recurrence})` : String(c.instrument ?? ''), value: `${c.classes_remaining} classes`, highlight: Number(c.classes_remaining) <= 2 }))
        : packages
        ? packages.map(p => ({ label: String(p.name ?? ''), value: `₹${p.price} · ${p.classes_count} classes` }))
        : Object.entries(entity)
            .filter(([k, v]) =>
              !['id', 'metadata', 'image', 'is_active', 'created_at', 'updated_at'].includes(k) &&
              v !== null && v !== undefined && v !== '' &&
              typeof v !== 'object'
            )
            .slice(0, 8)
            .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: String(v) }));
      return { ...base, type: 'card', title: resp.text, fields };
    }

    default:
      return { ...base, type: 'text', text: resp.text };
  }
}

interface ChatSessionState {
  sessionId: string | null;
  messages: ChatMessageUnion[];
  chips: QuickReplyChip[];
  isTyping: boolean;
  inputValue: string;
  error: string | null;
}

interface UseChatSessionReturn {
  state: ChatSessionState;
  sendMessage: (text: string) => Promise<void>;
  sendChip: (chip: QuickReplyChip) => Promise<void>;
  saveAttendance: (result: AttendancePickerResult) => Promise<void>;
  dismissError: () => void;
  setInputValue: (value: string) => void;
  resetSession: () => void;
}

const STORAGE_KEY = 'hsm_chat_session_v1';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function loadPersistedSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - new Date(parsed.lastActivityAt).getTime() > SESSION_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as { sessionId: string; messages: ChatMessageUnion[] };
  } catch {
    return null;
  }
}

function persistSession(sessionId: string, messages: ChatMessageUnion[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessionId,
      messages,
      lastActivityAt: new Date().toISOString(),
    }));
  } catch { /* storage quota */ }
}

function makeBotMessage(
  type: ChatMessageUnion['type'],
  sessionId: string,
  partial: Omit<ChatMessageUnion, 'id' | 'sender' | 'timestamp' | 'sessionId' | 'type'>
): ChatMessageUnion {
  return {
    id: crypto.randomUUID(),
    sender: 'bot',
    timestamp: new Date().toISOString(),
    sessionId,
    type,
    ...partial,
  } as ChatMessageUnion;
}

export function useChatSession(userRole: ChatUserRole): UseChatSessionReturn {
  const persisted = useRef(loadPersistedSession());

  const [state, setState] = useState<ChatSessionState>({
    sessionId:  persisted.current?.sessionId ?? null,
    messages:   persisted.current?.messages  ?? [],
    chips:      getRoleDefaultChips(userRole),
    isTyping:   false,
    inputValue: '',
    error:      null,
  });

  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state.sessionId) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      if (state.sessionId) persistSession(state.sessionId, state.messages);
    }, 500);
  }, [state.sessionId, state.messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: TextMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      timestamp: new Date().toISOString(),
      sessionId: state.sessionId ?? '',
      type: 'text',
      text: text.trim(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      chips: [],
      isTyping: true,
      error: null,
      inputValue: '',
    }));

    try {
      const resp: BotApiResponse = await apiPost('/api/chat', {
        session_id: state.sessionId,
        message: text.trim(),
      });

      const botMsg = botResponseToMessage(resp);

      const chips: QuickReplyChip[] = (resp.suggestions ?? []).map((s: string) => ({
        label: s,
        value: s,
      }));

      setState(prev => ({
        ...prev,
        sessionId: resp.session_id,
        messages: [...prev.messages, botMsg],
        chips,
        isTyping: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setState(prev => ({
        ...prev,
        isTyping: false,
        error: message,
        chips: [{ label: 'Try again', value: text.trim() }],
      }));
    }
  }, [state.sessionId]);

  const sendChip = useCallback(async (chip: QuickReplyChip) => {
    setState(prev => ({ ...prev, chips: [] }));
    await sendMessage(chip.value);
  }, [sendMessage]);

  const saveAttendance = useCallback(async (result: AttendancePickerResult) => {
    try {
      await apiPost('/api/attendance', {
        batch_id: result.batchId,
        session_date: result.sessionDate,
        records: result.attendance,
      });
      const confirmMsg = makeBotMessage('text', state.sessionId ?? '', {
        text: `Attendance saved for ${result.attendance.filter(a => a.status === 'present').length} present, ${result.attendance.filter(a => a.status === 'absent').length} absent.`,
      } as Omit<TextMessage, 'id' | 'sender' | 'timestamp' | 'sessionId' | 'type'>);
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, confirmMsg],
        chips: [{ label: 'Mark another batch', value: 'Mark attendance for another batch' }, { label: 'Done', value: 'Done' }],
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save attendance.';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [state.sessionId]);

  const dismissError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setInputValue = useCallback((value: string) => {
    setState(prev => ({ ...prev, inputValue: value }));
  }, []);

  const resetSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      sessionId:  null,
      messages:   [],
      chips:      getRoleDefaultChips(userRole),
      isTyping:   false,
      inputValue: '',
      error:      null,
    });
  }, [userRole]);

  return { state, sendMessage, sendChip, saveAttendance, dismissError, setInputValue, resetSession };
}
