import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import './chat.css';
import { ChatUserRole } from './chatTypes';
import { useChatSession } from './useChatSession';
import { MessageList } from './MessageList';
import { QuickReplyChips } from './QuickReplyChips';
import { ChatInput } from './ChatInput';
import { CleffAvatar } from './CleffAvatar';
import { AttendanceRoll } from './AttendanceRoll';
import { AttendanceHistory } from './AttendanceHistory';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { ChatMenu } from './ChatMenu';
import { AreaPill } from './AreaPill';
import { useMenuFlow } from './useMenuFlow';

interface ChatPanelProps {
  isOpen: boolean;
  userRole: ChatUserRole;
  userName?: string;
  onClose: () => void;
}

const ROLE_TAGLINES: Record<ChatUserRole, string> = {
  admin:   'Maestro · Music school command centre',
  head_of_school: 'Operations and curriculum, in tune',
  teacher: 'Your backstage pass to HSM',
  student: 'Your musical journey tracker',
  parent:  "Your child's musical diary",
};

const MOBILE_QUERY = '(max-width: 767px)';
const HALF_HEIGHT = 0.7;
const FULL_HEIGHT = 0.94;
const DRAG_CLOSE_PX = 80;
const DRAG_EXPAND_PX = 50;
const DRAG_TAP_PX = 6;
const EXIT_MS = 220;

type Detent = 'half' | 'full';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

// Tracks the area the user can actually see. iOS Safari keeps the layout viewport when the
// keyboard opens (only the visual viewport shrinks), so a bottom-fixed sheet has to follow
// visualViewport; Android Chrome resizes both thanks to interactive-widget=resizes-content.
function useVisibleViewport(active: boolean) {
  const baseline = useRef(0);
  const [vp, setVp] = useState({ height: window.innerHeight, offsetBottom: 0, keyboardOpen: false });
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const update = () => {
      const height = vv ? vv.height : window.innerHeight;
      baseline.current = Math.max(baseline.current, height);
      const offsetBottom = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      setVp({ height, offsetBottom, keyboardOpen: height < baseline.current * 0.8 });
    };
    const onOrientation = () => { baseline.current = 0; update(); };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', onOrientation);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, [active]);
  return vp;
}

function ChatPanelInner({ userRole, userName, onClose }: ChatPanelProps) {
  const isMobile = useIsMobile();
  const vp = useVisibleViewport(isMobile);
  const {
    state, sendMessage, sendChip, saveAttendance, runAction, addUserText, removeMessages, setArea, setChips,
    patchMessage, addBotText, dismissError, setInputValue, resetSession,
  } = useChatSession(userRole, userName);
  const menuFlow = useMenuFlow({ addBotText, addUserText, removeMessages, runAction, setArea, setChips });
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAreaId, setMenuAreaId] = useState<string | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const areaInfo = menuFlow.menu?.areas.find(a => a.id === state.area) ?? null;

  // A question that wants typed text: bring up the keyboard
  useEffect(() => {
    if (menuFlow.awaitingText) setFocusSignal(n => n + 1);
  }, [menuFlow.awaitingText]);

  const [entered, setEntered] = useState(false);
  const [detent, setDetent] = useState<Detent>('half');
  const [workId, setWorkId] = useState<string | null>(null);
  // Bumped when the chat should jump to its latest message (e.g. after saving attendance)
  const [bottomSignal, setBottomSignal] = useState(0);
  const dirty = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const lastSeen = useRef<string | undefined>(state.messages[state.messages.length - 1]?.id);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // A roll-call or history reply opens the full-height attendance layer by itself; messages
  // restored from an earlier visit don't.
  useEffect(() => {
    const last = state.messages[state.messages.length - 1];
    if (!last || last.id === lastSeen.current) return;
    lastSeen.current = last.id;
    if (last.sender === 'bot' && (last.type === 'attendance_roll' || last.type === 'attendance_history')) {
      dirty.current = 0;
      setWorkId(last.id);
    }
  }, [state.messages]);

  const confirmDiscard = useCallback(
    () => dirty.current === 0 || window.confirm(`Discard ${dirty.current} unsaved change${dirty.current === 1 ? '' : 's'}?`),
    [],
  );

  const requestClose = useCallback(() => {
    if (workId && !confirmDiscard()) return;
    setEntered(false);
    window.setTimeout(onClose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : EXIT_MS);
  }, [workId, confirmDiscard, onClose]);

  const closeWork = useCallback(() => {
    if (!confirmDiscard()) return;
    dirty.current = 0;
    setWorkId(null);
  }, [confirmDiscard]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menuOpen) setMenuOpen(false);
      else if (workId) closeWork();
      else requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, workId, closeWork, requestClose]);

  // The page behind must not scroll while the sheet covers it
  useEffect(() => {
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMobile]);

  const workMsg = workId ? state.messages.find(m => m.id === workId) : undefined;
  useEffect(() => { if (workId && !workMsg) setWorkId(null); }, [workId, workMsg]);

  // ── Sheet dragging (handle and header only; the message list just scrolls) ──
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, dy: 0 };
    sheetRef.current?.classList.add('chat-sheet--dragging');
  };
  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current.dy = e.clientY - drag.current.y;
    sheetRef.current?.style.setProperty('--drag', `${Math.max(0, drag.current.dy)}px`);
  };
  const onDragEnd = () => {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    sheetRef.current?.classList.remove('chat-sheet--dragging');
    sheetRef.current?.style.setProperty('--drag', '0px');
    if (Math.abs(dy) < DRAG_TAP_PX) { setDetent(d => (d === 'half' ? 'full' : 'half')); return; }
    if (dy > DRAG_CLOSE_PX) { if (detent === 'full' && !workId) setDetent('half'); else requestClose(); }
    else if (dy < -DRAG_EXPAND_PX) setDetent('full');
  };
  const stopDrag = (e: ReactPointerEvent) => e.stopPropagation();

  const body = (
    <>
      {state.error && (
        <div role="alert" style={{
          background: '#fdf0f0', borderBottom: '1px solid #f5c6c6', padding: '8px 14px', fontSize: 12, color: '#721c24',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <span>{state.error}</span>
          <button onClick={dismissError} type="button" aria-label="Dismiss" style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#721c24', padding: '0 4px' }}>×</button>
        </div>
      )}

      <MessageList
        messages={state.messages}
        isTyping={state.isTyping}
        userRole={userRole}
        onChipSelect={(value) => sendMessage(value)}
        onAttendanceSave={saveAttendance}
        onDefaultChipSelect={(value) => sendMessage(value)}
        onOpenWork={(id) => { dirty.current = 0; setWorkId(id); }}
        onRunAction={(label, skill, params) => { void runAction(label, skill, params); }}
        compact={isMobile}
        bottomSignal={bottomSignal}
      />

      <QuickReplyChips
        chips={state.chips}
        onSelect={sendChip}
        disabled={state.isTyping}
        leading={areaInfo && (
          <AreaPill
            icon={areaInfo.icon}
            label={areaInfo.label}
            onSwitch={() => { setMenuAreaId(null); setMenuOpen(true); }}
            onClear={() => setArea(null)}
          />
        )}
      />

      <ChatInput
        value={state.inputValue}
        onChange={setInputValue}
        onSend={() => {
          const text = state.inputValue;
          if (!text.trim()) return;
          // A menu question waiting for text takes the message as its answer
          if (menuFlow.consumeTyped(text)) { setInputValue(''); return; }
          void sendMessage(text);
        }}
        disabled={state.isTyping}
        keyboardOpen={isMobile && vp.keyboardOpen}
        onMenu={menuFlow.menu ? () => { setMenuAreaId(state.area); setMenuOpen(true); } : undefined}
        focusSignal={focusSignal}
        placeholder={menuFlow.awaitingText ? 'Type your answer…' : undefined}
      />
    </>
  );

  // The attendance layer covers the whole sheet/panel: one header (with the drag handle on a
  // phone), the list, and a sticky Submit.
  const workLayer = workMsg && (workMsg.type === 'attendance_roll' || workMsg.type === 'attendance_history') && (
    <div className="chat-work" role="region" aria-label="Attendance">
      <div
        className={isMobile ? 'chat-grab' : undefined}
        onPointerDown={isMobile ? onDragStart : undefined}
        onPointerMove={isMobile ? onDragMove : undefined}
        onPointerUp={isMobile ? onDragEnd : undefined}
        onPointerCancel={isMobile ? onDragEnd : undefined}
        style={{ background: 'linear-gradient(135deg, #1b1307 0%, #2d2110 100%)', color: '#f3c13a', flexShrink: 0 }}
      >
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(243,193,58,0.6)' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 6px', minHeight: 46 }}>
          <button
            type="button" onPointerDown={stopDrag} onClick={closeWork}
            style={{ background: 'none', border: 'none', color: '#f3c13a', fontSize: 15, fontWeight: 700, minHeight: 40, padding: '0 8px', cursor: 'pointer' }}
          >
            ‹ Chat
          </button>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
            {workMsg.title}
          </div>
          <span style={{ width: 56 }} />
        </div>
      </div>
      {workMsg.type === 'attendance_roll' ? (
        <AttendanceRoll
          key={workMsg.id}
          date={workMsg.date}
          editable={workMsg.editable}
          groups={workMsg.groups}
          onDirtyChange={(n) => { dirty.current = n; }}
          onSaved={(groups, text) => {
            patchMessage(workMsg.id, { groups });
            dirty.current = 0;
            setWorkId(null);
            addBotText(text, [{ label: 'Another roll-call', value: 'Attendance today' }]);
            setBottomSignal(n => n + 1);
          }}
        />
      ) : (
        <AttendanceHistory
          key={workMsg.id}
          studentId={workMsg.studentId}
          rows={workMsg.rows}
          onDirtyChange={(n) => { dirty.current = n; }}
          onSaved={(rows, text) => {
            patchMessage(workMsg.id, { rows });
            dirty.current = 0;
            setWorkId(null);
            addBotText(text);
            setBottomSignal(n => n + 1);
          }}
        />
      )}
    </div>
  );

  // The menu covers the sheet like the attendance layer; picking an option hands it to the chat
  const menuLayer = menuOpen && menuFlow.menu && (
    <ChatMenu
      key={menuAreaId ?? 'root'}
      areas={menuFlow.menu.areas}
      initialAreaId={menuAreaId}
      isMobile={isMobile}
      dragProps={isMobile ? { onPointerDown: onDragStart, onPointerMove: onDragMove, onPointerUp: onDragEnd, onPointerCancel: onDragEnd } : undefined}
      onPick={(area, item) => { setMenuOpen(false); menuFlow.start(area, item); }}
      onClose={() => setMenuOpen(false)}
    />
  );

  if (isMobile) {
    const frac = (workId ? 'full' : detent) === 'full' ? FULL_HEIGHT : HALF_HEIGHT;
    const height = vp.keyboardOpen ? vp.height - 8 : Math.round(vp.height * frac);
    return (
      <>
        <div className={`chat-backdrop${entered ? ' chat-backdrop--open' : ''}`} onClick={requestClose} aria-hidden="true" />
        <div
          ref={sheetRef}
          className={`chat-sheet${entered ? ' chat-sheet--open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Cleff chat"
          style={{ bottom: vp.offsetBottom, height }}
        >
          <div
            className="chat-grab"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(243,193,58,0.6)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 6px 12px' }}>
              <CleffAvatar size={26} />
              <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#f3c13a', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                Cleff
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#27ae60', display: 'inline-block' }} />
              </div>
              <button
                type="button" onPointerDown={stopDrag} onClick={resetSession} aria-label="Start a new chat" title="New chat"
                style={{ background: 'none', border: 'none', color: '#f3c13a', fontSize: 18, width: 40, height: 40, cursor: 'pointer' }}
              >
                ↺
              </button>
              <button
                type="button" onPointerDown={stopDrag} onClick={requestClose} aria-label="Close chat"
                style={{ background: 'none', border: 'none', color: '#f3c13a', fontSize: 24, width: 40, height: 40, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {body}
          </div>
          {workLayer}
          {menuLayer}
        </div>
      </>
    );
  }

  // Desktop: the floating card, unchanged apart from hosting the attendance layer
  return (
    <div
      className={`chat-panel${entered ? ' chat-panel--open' : ''}`}
      role="dialog"
      aria-label="Cleff chat"
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        width: 'min(380px, calc(100vw - 16px))',
        height: 'min(560px, calc(100vh - 100px))',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #1b1307 0%, #2d2110 100%)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <CleffAvatar size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f3c13a', letterSpacing: 0.5 }}>Cleff</div>
          <div style={{ fontSize: 11, color: '#f3c13a', opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#27ae60', display: 'inline-block' }} />
            {ROLE_TAGLINES[userRole]}
          </div>
        </div>
        <button
          onClick={requestClose}
          type="button"
          style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#f3c13a', lineHeight: 1, padding: 4 }}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {body}
      </div>
      {workLayer}
      {menuLayer}
    </div>
  );
}

export function ChatPanel(props: ChatPanelProps) {
  return (
    <ChatErrorBoundary onClose={props.onClose}>
      <ChatPanelInner {...props} />
    </ChatErrorBoundary>
  );
}
