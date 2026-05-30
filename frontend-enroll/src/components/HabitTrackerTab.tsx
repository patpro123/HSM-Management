import React, { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import XPBadge from './XPBadge';

interface Habit {
    id: string;
    title: string;
    icon: string;
    display_order: number;
    habit_type?: string;
    habit_level?: string;
    todayTheoryQuestion?: TheoryQuestion | null;
}

interface TheoryQuestion {
    id: string;
    question: string;
    answer_hint?: string | null;
    sheet_storage_id?: string | null;
}

interface LogMeta {
    logId: string;
    hasVoiceNote: boolean;
    theoryQuestionId: string | null;
    theoryAnswerText: string | null;
    theoryAnswerCorrect: boolean | null;
    theoryQuestionText: string | null;
    theoryAnswerHint: string | null;
}

interface UserStats {
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
}

interface XPEvent {
    event_type: string;
    points: number;
    metadata: Record<string, unknown>;
    awarded_at: string;
}

interface XPSummary {
    totalXP: number;
    recentEvents: XPEvent[];
}

interface VoiceNotePrompt {
    logId: string;
    homeworkTitle: string;
    completed: number;
    target: number;
}

interface TheoryPrompt {
    habitId: string;
    question: TheoryQuestion;
}

interface HabitTrackerTabProps {
    studentId: string;
    selfMode: boolean;
}

const MUSIC_ICONS = ['🎵', '🎸', '🎹', '🎼', '🥁', '🎤', '🎧', '🎬', '📖', '👂', '🎻', '🪗'];

const XP_EVENT_LABELS: Record<string, string> = {
    habit_log:                 'Daily habit check-off',
    streak_milestone_7:        '7-day streak milestone',
    streak_milestone_30:       '30-day streak milestone',
    homework_submit_ontime:    'Homework submitted on time',
    homework_submit_late:      'Homework submitted',
    homework_grade:            'Homework graded',
    homework_grade_perfect:    'Perfect score bonus',
    homework_habit_target:     'Practice target achieved',
    theory_correct:            'Theory answer marked correct',
};

const CATALOGUE = [
    { category: 'Warm-up',            habits: [{ icon: '🎵', title: 'Finger warmup exercises' }] },
    { category: 'Scales & Technique', habits: [
        { icon: '🎼', title: 'Scales practice (major/minor)' },
        { icon: '🎹', title: 'Arpeggios / chord inversions' },
        { icon: '🥁', title: 'Rudiments / sticking patterns' },
    ]},
    { category: 'Repertoire',         habits: [
        { icon: '🎸', title: 'Work on current song/piece' },
        { icon: '🎤', title: 'Vocal riyaz / raga practice' },
    ]},
    { category: 'Theory',             habits: [{ icon: '📖', title: 'Music theory study (15 min)' }] },
    { category: 'Ear Training',       habits: [
        { icon: '👂', title: 'Interval / pitch recognition' },
        { icon: '🎧', title: 'Active listening (one track)' },
    ]},
    { category: 'Performance Prep',   habits: [{ icon: '🎬', title: 'Record & review self-video' }] },
];

function getLast7Days() {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
            date: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString('en-US', { weekday: 'short' }),
            day: d.getDate(),
        };
    });
}

function dayCircleClass(completed: number, total: number) {
    if (total === 0 || completed === 0) return 'bg-slate-100 text-slate-400';
    const pct = completed / total;
    if (pct >= 0.8) return 'bg-green-500 text-white';
    if (pct >= 0.5) return 'bg-amber-400 text-white';
    return 'bg-orange-300 text-white';
}

const ProgressRing: React.FC<{ completed: number; total: number }> = ({ completed, total }) => {
    const R = 40;
    const C = 2 * Math.PI * R;
    const pct = total > 0 ? completed / total : 0;
    return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <circle
                cx="50" cy="50" r={R} fill="none"
                stroke="#f97316" strokeWidth="10"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
            <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1f2937">{completed}</text>
            <text x="50" y="61" textAnchor="middle" fontSize="10" fill="#6b7280">of {total}</text>
        </svg>
    );
};

const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

const HabitTrackerTab: React.FC<HabitTrackerTabProps> = ({ studentId, selfMode }) => {
    const [habits, setHabits]     = useState<Habit[]>([]);
    const [logs, setLogs]         = useState<Record<string, string[]>>({});
    const [logMeta, setLogMeta]   = useState<Record<string, LogMeta>>({});
    const [stats, setStats]       = useState<UserStats>({ currentStreak: 0, longestStreak: 0, totalCompletions: 0 });
    const [xp, setXP]             = useState<XPSummary>({ totalXP: 0, recentEvents: [] });
    const [loading, setLoading]   = useState(true);
    const [studentInfo, setStudentInfo] = useState<{ instrument: string; trinity_grade: string } | null>(null);
    const [predefinedItems, setPredefinedItems] = useState<{ id: string; title: string; icon: string }[]>([]);
    const [loadingPredefined, setLoadingPredefined] = useState(false);

    useEffect(() => {
        if (!studentInfo?.instrument) return;
        const fetchPredefined = async () => {
            setLoadingPredefined(true);
            try {
                const res = await apiGet(`/api/practice-items?instrument=${encodeURIComponent(studentInfo.instrument)}`);
                setPredefinedItems(res.items || []);
            } catch (err) {
                console.error('Failed to fetch predefined practice items for student:', err);
            } finally {
                setLoadingPredefined(false);
            }
        };
        fetchPredefined();
    }, [studentInfo]);

    const [saving, setSaving] = useState(false);

    // Teacher: add habit for student
    const [teacherAddOpen, setTeacherAddOpen]   = useState(false);
    const [teacherAddTab, setTeacherAddTab]     = useState<'catalogue' | 'custom' | 'theory'>('catalogue');
    const [teacherCustomTitle, setTeacherCustomTitle] = useState('');
    const [teacherCustomIcon, setTeacherCustomIcon]   = useState('🎵');
    const [teacherTheoryLevel, setTeacherTheoryLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');

    // Edit habit
    const [editingId, setEditingId]     = useState<string | null>(null);
    const [editTitle, setEditTitle]     = useState('');
    const [editIcon, setEditIcon]       = useState('');

    // Voice note prompt (shown after toggling a target habit ON)
    const [voiceNotePrompt, setVoiceNotePrompt] = useState<VoiceNotePrompt | null>(null);
    const [vnRecordState, setVnRecordState]     = useState<'idle' | 'recording' | 'recorded'>('idle');
    const [vnBlob, setVnBlob]                   = useState<Blob | null>(null);
    const [vnUrl, setVnUrl]                     = useState<string | null>(null);
    const [vnSeconds, setVnSeconds]             = useState(0);
    const [vnSending, setVnSending]             = useState(false);
    const vnMediaRef  = useRef<MediaRecorder | null>(null);
    const vnChunksRef = useRef<Blob[]>([]);
    const vnTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

    // Theory question prompt (shown before checking off a theory habit)
    const [theoryPrompt, setTheoryPrompt]         = useState<TheoryPrompt | null>(null);
    const [theoryAnswerText, setTheoryAnswerText]  = useState('');
    const [theoryAnswerFile, setTheoryAnswerFile]  = useState<string | null>(null);
    const [theoryAnswerFileName, setTheoryAnswerFileName] = useState('');
    const [theorySubmitting, setTheorySubmitting] = useState(false);
    const theoryFileRef = useRef<HTMLInputElement | null>(null);

    // Pending toggle after theory modal confirm
    const pendingTheoryHabitId = useRef<string | null>(null);

    // Voice note playback in habit list
    const [playingVoiceNoteKey, setPlayingVoiceNoteKey] = useState<string | null>(null);

    const today = new Date().toISOString().slice(0, 10);
    const last7 = getLast7Days();

    const fetchHabits = async () => {
        try {
            const [habitsRes, xpRes] = await Promise.all([
                apiGet(`/api/students/${studentId}/habits`),
                apiGet(`/api/students/${studentId}/xp`),
            ]);
            setHabits(habitsRes.habits || []);
            setLogs(habitsRes.logs || {});
            setLogMeta(habitsRes.logMeta || {});
            setStats(habitsRes.stats || { currentStreak: 0, longestStreak: 0, totalCompletions: 0 });
            setXP({ totalXP: xpRes.totalXP ?? 0, recentEvents: xpRes.recentEvents || [] });
            setStudentInfo(habitsRes.studentInfo || null);
        } catch (err) {
            console.error('Failed to fetch habits', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchHabits(); }, [studentId]);

    const todayIds        = logs[today] || [];
    const completedToday  = todayIds.length;

    // ── Toggle habit ──────────────────────────────────────────────────────────

    const performToggle = async (habitId: string, theoryQId?: string, theoryText?: string, theoryFile?: string | null) => {
        const wasLogged = todayIds.includes(habitId);
        setLogs(prev => ({
            ...prev,
            [today]: wasLogged
                ? (prev[today] || []).filter(id => id !== habitId)
                : [...(prev[today] || []), habitId],
        }));
        try {
            const body: Record<string, unknown> = {};
            if (theoryQId) body.theory_question_id = theoryQId;
            if (theoryText) body.theory_answer_text = theoryText;
            if (theoryFile) body.theory_answer_file = theoryFile;

            const data = await apiPost(`/api/habits/${habitId}/log`, body);

            if (data.logged && data.logId && (data.linkedHomework?.length ?? 0) > 0) {
                const hw = data.linkedHomework[0];
                setVoiceNotePrompt({
                    logId: data.logId,
                    homeworkTitle: hw.title,
                    completed: Number(hw.habit_target_completed),
                    target: hw.habit_target_count,
                });
            }
            // Refresh XP after a moment to pick up awarded points
            setTimeout(() => {
                apiGet(`/api/students/${studentId}/xp`)
                    .then(xpRes => setXP({ totalXP: xpRes.totalXP ?? 0, recentEvents: xpRes.recentEvents || [] }))
                    .catch(() => {});
            }, 800);
        } catch {
            setLogs(prev => ({
                ...prev,
                [today]: wasLogged
                    ? [...(prev[today] || []), habitId]
                    : (prev[today] || []).filter(id => id !== habitId),
            }));
        }
    };

    const toggleLog = (habit: Habit) => {
        if (!selfMode) return;
        const wasLogged = todayIds.includes(habit.id);
        if (wasLogged) {
            // Un-toggle directly — no prompts needed
            performToggle(habit.id);
            return;
        }
        // Theory habit with an unanswered question → show modal first
        if (habit.habit_type === 'theory' && habit.todayTheoryQuestion) {
            pendingTheoryHabitId.current = habit.id;
            setTheoryPrompt({ habitId: habit.id, question: habit.todayTheoryQuestion });
            setTheoryAnswerText('');
            setTheoryAnswerFile(null);
            setTheoryAnswerFileName('');
            return;
        }
        performToggle(habit.id);
    };

    // ── Theory modal actions ──────────────────────────────────────────────────

    const handleTheorySubmit = async () => {
        if (!theoryPrompt) return;
        setTheorySubmitting(true);
        try {
            await performToggle(theoryPrompt.habitId, theoryPrompt.question.id, theoryAnswerText, theoryAnswerFile);
        } finally {
            setTheorySubmitting(false);
            setTheoryPrompt(null);
            pendingTheoryHabitId.current = null;
        }
    };

    const handleTheorySkip = async () => {
        if (!theoryPrompt) return;
        setTheorySubmitting(true);
        try {
            await performToggle(theoryPrompt.habitId);
        } finally {
            setTheorySubmitting(false);
            setTheoryPrompt(null);
            pendingTheoryHabitId.current = null;
        }
    };

    const handleTheoryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setTheoryAnswerFile(reader.result as string);
            setTheoryAnswerFileName(file.name);
        };
        reader.readAsDataURL(file);
    };

    // ── Voice note recording ──────────────────────────────────────────────────

    const startVoiceNote = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus' : 'audio/webm';
            const recorder = new MediaRecorder(stream, { mimeType });
            vnMediaRef.current  = recorder;
            vnChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) vnChunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(vnChunksRef.current, { type: mimeType });
                setVnBlob(blob);
                setVnUrl(URL.createObjectURL(blob));
                setVnRecordState('recorded');
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start(100);
            setVnRecordState('recording');
            setVnSeconds(0);
            vnTimerRef.current = setInterval(() => {
                setVnSeconds(s => {
                    if (s >= 29) { stopVoiceNote(); return 30; }
                    return s + 1;
                });
            }, 1000);
        } catch {
            // microphone denied — dismiss prompt silently
            dismissVoiceNote();
        }
    };

    const stopVoiceNote = () => {
        vnMediaRef.current?.stop();
        if (vnTimerRef.current) { clearInterval(vnTimerRef.current); vnTimerRef.current = null; }
    };

    const discardVoiceNote = () => {
        if (vnUrl) URL.revokeObjectURL(vnUrl);
        setVnBlob(null); setVnUrl(null); setVnRecordState('idle'); setVnSeconds(0);
    };

    const dismissVoiceNote = () => {
        discardVoiceNote();
        setVoiceNotePrompt(null);
    };

    const sendVoiceNote = async () => {
        if (!vnBlob || !voiceNotePrompt) return;
        setVnSending(true);
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(vnBlob);
            });
            await apiPost(`/api/habits/logs/${voiceNotePrompt.logId}/voice-note`, {
                file_name: `voice_${Date.now()}.webm`,
                file_type: vnBlob.type || 'audio/webm',
                file_data: base64,
            });
            dismissVoiceNote();
        } catch (err) {
            console.error('Failed to send voice note', err);
        } finally {
            setVnSending(false);
        }
    };

    // ── Add / edit habits ─────────────────────────────────────────────────────

    const startEdit = (h: Habit) => { setEditingId(h.id); setEditTitle(h.title); setEditIcon(h.icon); };

    const saveEdit = async () => {
        if (!editingId || !editTitle.trim() || saving) return;
        setSaving(true);
        try {
            const res = await apiPut(`/api/habits/${editingId}`, { title: editTitle.trim(), icon: editIcon });
            setHabits(prev => prev.map(h => h.id === editingId ? res.habit : h));
            setEditingId(null);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const archiveHabit = async (habitId: string) => {
        if (!confirm('Remove this habit? Your past logs will be preserved.')) return;
        try {
            await apiDelete(`/api/habits/${habitId}`);
            setHabits(prev => prev.filter(h => h.id !== habitId));
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Failed to remove habit');
        }
    };

    // ── Teacher: grade theory answer ──────────────────────────────────────────

    const gradeTheoryAnswer = async (logId: string, correct: boolean) => {
        try {
            await apiPut(`/api/habits/logs/${logId}/theory-answer`, { correct });
            setLogMeta(prev => ({
                ...prev,
                ...Object.fromEntries(
                    Object.entries(prev).map(([k, v]) =>
                        v.logId === logId ? [k, { ...v, theoryAnswerCorrect: correct }] : [k, v]
                    )
                ),
            }));
        } catch (err) {
            console.error('Failed to grade theory answer', err);
        }
    };

    if (loading) {
        return <div className="py-16 text-center text-slate-500">Loading habits...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Theory question modal */}
            {theoryPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Theory Question</p>
                        <p className="text-base font-medium text-slate-800 leading-snug">
                            {theoryPrompt.question.question}
                        </p>
                        {theoryPrompt.question.sheet_storage_id && (
                            <a
                                href={`/api/files/${theoryPrompt.question.sheet_storage_id}/stream`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800"
                            >
                                📄 View sheet
                            </a>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Your answer</label>
                            <textarea
                                value={theoryAnswerText}
                                onChange={e => setTheoryAnswerText(e.target.value)}
                                rows={2}
                                placeholder="Type your answer here…"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Attach scan <span className="font-normal text-slate-400">(optional — image or PDF)</span>
                            </label>
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-100 cursor-pointer">
                                📎 {theoryAnswerFileName || 'Choose file'}
                                <input
                                    ref={theoryFileRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleTheoryFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={handleTheorySubmit}
                                disabled={theorySubmitting}
                                className="flex-1 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50"
                            >
                                {theorySubmitting ? 'Submitting…' : 'Submit & check off'}
                            </button>
                            <button
                                onClick={handleTheorySkip}
                                disabled={theorySubmitting}
                                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200"
                            >
                                Skip & check off
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Voice note prompt */}
            {voiceNotePrompt && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold text-sky-800">Add a voice note for your teacher?</p>
                            {voiceNotePrompt.target > 0 ? (
                                <p className="text-xs text-sky-600 mt-0.5">
                                    "{voiceNotePrompt.homeworkTitle}" — {voiceNotePrompt.completed}/{voiceNotePrompt.target} sessions logged
                                </p>
                            ) : (
                                <p className="text-xs text-sky-600 mt-0.5">
                                    Evidence for: {voiceNotePrompt.homeworkTitle}
                                </p>
                            )}
                        </div>
                        <button onClick={dismissVoiceNote} className="text-sky-400 hover:text-sky-600 text-lg leading-none">✕</button>
                    </div>

                    {vnRecordState === 'idle' && (
                        <div className="flex gap-2">
                            <button
                                onClick={startVoiceNote}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-xs font-semibold rounded-full hover:bg-red-600"
                            >
                                <span className="w-2 h-2 rounded-full bg-white" /> Start Recording (max 30s)
                            </button>
                            <button onClick={dismissVoiceNote} className="text-xs text-slate-500 hover:text-slate-700 px-2">Skip</button>
                        </div>
                    )}

                    {vnRecordState === 'recording' && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={stopVoiceNote}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-xs font-semibold rounded-full hover:bg-gray-900"
                            >
                                <span className="w-2 h-2 rounded-sm bg-white" /> Stop
                            </button>
                            <span className="text-sm font-mono font-bold text-red-500 animate-pulse">{fmt(vnSeconds)}</span>
                            <span className="flex gap-0.5 items-end h-4">
                                {[3,5,4,6,3,5,4].map((h, i) => (
                                    <span key={i} className="w-1 bg-red-400 rounded-full animate-bounce"
                                        style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms` }} />
                                ))}
                            </span>
                        </div>
                    )}

                    {vnRecordState === 'recorded' && vnUrl && (
                        <div className="space-y-2">
                            <audio src={vnUrl} controls className="h-10 w-full" />
                            <div className="flex gap-2">
                                <button
                                    onClick={sendVoiceNote}
                                    disabled={vnSending}
                                    className="px-4 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 disabled:opacity-50"
                                >
                                    {vnSending ? 'Sending…' : 'Send to teacher'}
                                </button>
                                <button onClick={discardVoiceNote} className="text-xs text-slate-400 hover:text-red-500 underline">Discard</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Stats + Progress Row */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex flex-col items-center bg-orange-50 border border-orange-100 rounded-xl px-6 py-4 min-w-[110px]">
                    <span className="text-2xl">🔥</span>
                    <span className="text-2xl font-bold text-slate-800 mt-1">{stats.currentStreak}</span>
                    <span className="text-xs text-slate-500 mt-0.5">Current streak</span>
                </div>
                <div className="flex flex-col items-center bg-amber-50 border border-amber-100 rounded-xl px-6 py-4 min-w-[110px]">
                    <span className="text-2xl">🏆</span>
                    <span className="text-2xl font-bold text-slate-800 mt-1">{stats.longestStreak}</span>
                    <span className="text-xs text-slate-500 mt-0.5">Longest streak</span>
                </div>
                <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-xl px-6 py-4 min-w-[110px]">
                    <span className="text-2xl">✅</span>
                    <span className="text-2xl font-bold text-slate-800 mt-1">{stats.totalCompletions}</span>
                    <span className="text-xs text-slate-500 mt-0.5">Total check-ins</span>
                </div>
                <div className="ml-auto flex flex-col items-center">
                    <ProgressRing completed={completedToday} total={habits.length} />
                    <span className="text-xs text-slate-500 mt-1">Today</span>
                </div>
            </div>

            {/* XP rank + progress */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                <XPBadge totalXP={xp.totalXP} />
            </div>

            {/* Recent XP events */}
            {xp.recentEvents.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent XP</p>
                    <ul className="space-y-1">
                        {xp.recentEvents.slice(0, 5).map((ev, i) => (
                            <li key={i} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                                <span>{XP_EVENT_LABELS[ev.event_type] ?? ev.event_type}</span>
                                <span className="font-semibold text-green-600">+{ev.points} XP</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 7-day mini-calendar */}
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Last 7 Days</p>
                <div className="flex gap-2">
                    {last7.map(({ date, label, day }) => {
                        const completed = (logs[date] || []).length;
                        return (
                            <div key={date} className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-xs text-slate-400">{label}</span>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${dayCircleClass(completed, habits.length)}`}>
                                    {day}
                                </div>
                                <span className="text-[10px] text-slate-400">{habits.length > 0 ? `${completed}/${habits.length}` : '—'}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Habit List */}
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Practice Habits</p>
                {habits.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        {selfMode
                            ? 'No habits yet. Add your first music practice habit below.'
                            : 'No habits set up yet.'}
                    </div>
                )}
                <ul className="space-y-2">
                    {habits.map(h => {
                        const isLogged  = todayIds.includes(h.id);
                        const isEditing = editingId === h.id;
                        const metaKey   = `${h.id}__${today}`;
                        const meta      = logMeta[metaKey];
                        return (
                            <li key={h.id} className={`rounded-xl border transition-colors ${isLogged ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                <div className="flex items-center gap-3 p-3">
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => toggleLog(h)}
                                        disabled={!selfMode}
                                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isLogged ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-green-400'} ${!selfMode ? 'cursor-default' : 'cursor-pointer'}`}
                                        aria-label={isLogged ? 'Uncheck' : 'Check off'}
                                    >
                                        {isLogged && (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>

                                    {isEditing ? (
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="flex gap-1 flex-wrap">
                                                {MUSIC_ICONS.map(ic => (
                                                    <button key={ic} onClick={() => setEditIcon(ic)}
                                                        className={`text-lg rounded px-1 ${editIcon === ic ? 'bg-orange-100 ring-1 ring-orange-400' : 'hover:bg-slate-100'}`}>
                                                        {ic}
                                                    </button>
                                                ))}
                                            </div>
                                            <input
                                                className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm min-w-0"
                                                value={editTitle}
                                                onChange={e => setEditTitle(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                                autoFocus
                                            />
                                            <button onClick={saveEdit} disabled={saving} className="text-xs bg-orange-500 text-white px-2 py-1 rounded-lg hover:bg-orange-600">Save</button>
                                            <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 hover:text-slate-700 px-1">✕</button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-xl">{h.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-sm font-medium ${isLogged ? 'text-green-700 line-through decoration-green-400' : 'text-slate-700'}`}>
                                                    {h.title}
                                                </span>
                                                {h.habit_type === 'theory' && (
                                                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                        h.habit_level === 'advanced' ? 'bg-purple-100 text-purple-700' :
                                                        h.habit_level === 'intermediate' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {h.habit_level}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-auto">
                                                {/* Voice note play button (today's log) */}
                                                {isLogged && meta?.hasVoiceNote && meta?.logId && (
                                                    <button
                                                        onClick={() => setPlayingVoiceNoteKey(playingVoiceNoteKey === metaKey ? null : metaKey)}
                                                        title={playingVoiceNoteKey === metaKey ? 'Stop' : 'Play voice evidence'}
                                                        className={`text-sm p-0.5 rounded transition-colors ${playingVoiceNoteKey === metaKey ? 'text-sky-700' : 'text-sky-400 hover:text-sky-600'}`}
                                                    >
                                                        🎙
                                                    </button>
                                                )}
                                                {/* Student: optional evidence button (when logged today, no voice note yet) */}
                                                {selfMode && isLogged && !meta?.hasVoiceNote && meta?.logId && (
                                                    <button
                                                        onClick={() => setVoiceNotePrompt({ logId: meta.logId, homeworkTitle: h.title, completed: 0, target: 0 })}
                                                        className="text-slate-300 hover:text-sky-500 p-1"
                                                        title="Add voice evidence (optional)"
                                                        aria-label="Add voice evidence"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                        </svg>
                                                    </button>
                                                )}
                                                {/* Teacher: edit & delete controls */}
                                                {!selfMode && (
                                                    <>
                                                        <button onClick={() => startEdit(h)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Edit habit">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                                                            </svg>
                                                        </button>
                                                        <button onClick={() => archiveHabit(h.id)} className="text-slate-400 hover:text-red-500 p-1" aria-label="Remove habit">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Teacher view: show theory answer for today's log */}
                                {!selfMode && isLogged && meta?.theoryQuestionText && (
                                    <div className="px-3 pb-3 pt-0 border-t border-slate-100 mt-0 space-y-1">
                                        <p className="text-xs text-slate-400 italic">{meta.theoryQuestionText}</p>
                                        {meta.theoryAnswerText && (
                                            <p className="text-xs text-slate-700">{meta.theoryAnswerText}</p>
                                        )}
                                        {meta.theoryAnswerCorrect === null || meta.theoryAnswerCorrect === undefined ? (
                                            <div className="flex gap-2 mt-1">
                                                <button
                                                    onClick={() => gradeTheoryAnswer(meta.logId, true)}
                                                    className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                                                >
                                                    ✓ Correct
                                                </button>
                                                <button
                                                    onClick={() => gradeTheoryAnswer(meta.logId, false)}
                                                    className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                                                >
                                                    ✗ Incorrect
                                                </button>
                                            </div>
                                        ) : (
                                            <span className={`text-xs font-medium ${meta.theoryAnswerCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                                {meta.theoryAnswerCorrect ? '✓ Marked correct (+5 XP)' : '✗ Marked incorrect'}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Inline voice note player — shown when play button clicked (teacher or student) */}
                                {isLogged && meta?.hasVoiceNote && meta?.logId && playingVoiceNoteKey === metaKey && (
                                    <div className="px-3 pb-3 border-t border-sky-100 bg-sky-50 pt-2 space-y-1">
                                        <p className="text-xs font-medium text-sky-700">
                                            {selfMode ? 'Your voice evidence' : 'Student voice evidence'}
                                        </p>
                                        <audio
                                            controls
                                            autoPlay
                                            src={`/api/habits/logs/${meta.logId}/voice-note`}
                                            className="h-10 w-full"
                                            onEnded={() => setPlayingVoiceNoteKey(null)}
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            {selfMode && habits.length === 0 && (
                <p className="text-xs text-center text-slate-400">Your teacher will assign practice habits for you.</p>
            )}

            {/* Teacher: Add habit for student (catalogue + custom + theory) */}
            {!selfMode && (
                <div>
                    {!teacherAddOpen ? (
                        <button
                            onClick={() => setTeacherAddOpen(true)}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="text-lg">+</span> Assign a habit to this student
                        </button>
                    ) : (
                        <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 space-y-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign habit to student</p>
                            <div className="flex gap-2 border-b border-slate-200 pb-2">
                                {(['catalogue', 'custom', 'theory'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setTeacherAddTab(tab)}
                                        className={`text-sm font-medium px-3 py-1 rounded-lg ${teacherAddTab === tab ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {tab === 'theory' ? 'Theory Habit' : tab === 'catalogue' ? 'From catalogue' : 'Custom'}
                                    </button>
                                ))}
                                <button onClick={() => setTeacherAddOpen(false)} className="ml-auto text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            {teacherAddTab === 'catalogue' && (
                                <div className="space-y-4">
                                    {/* Predefined practice curriculum templates */}
                                    {studentInfo && (
                                        <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-3.5 space-y-2.5">
                                            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                                                🎯 Predefined Curriculum: {studentInfo.instrument} ({studentInfo.trinity_grade || 'All Grades'})
                                            </p>
                                            {loadingPredefined ? (
                                                <p className="text-xs text-slate-400 animate-pulse">Loading curriculum...</p>
                                            ) : predefinedItems.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">No predefined practice items found for this instrument.</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {predefinedItems
                                                        .filter(item => !habits.some(existing => existing.title === item.title))
                                                        .map(item => (
                                                            <button
                                                                key={item.id}
                                                                onClick={async () => {
                                                                    if (saving) return;
                                                                    setSaving(true);
                                                                    try {
                                                                        const res = await apiPost(`/api/students/${studentId}/habits`, {
                                                                            title: item.title,
                                                                            icon: item.icon,
                                                                            type: 'practice'
                                                                        });
                                                                        setHabits(prev => [...prev, res.habit]);
                                                                        setTeacherAddOpen(false);
                                                                    } catch (err: unknown) {
                                                                        alert(err instanceof Error ? err.message : 'Failed to add habit');
                                                                    } finally { setSaving(false); }
                                                                }}
                                                                disabled={saving}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs text-slate-700 hover:border-emerald-500 hover:text-emerald-800 hover:bg-emerald-50 transition-colors shadow-sm font-semibold"
                                                            >
                                                                <span>{item.icon}</span> {item.title}
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* General catalogue */}
                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            🌍 General Practice Catalogue
                                        </p>
                                        {CATALOGUE.map(group => {
                                            const available = group.habits.filter(
                                                h => !habits.some(existing => existing.title === h.title)
                                            );
                                            if (!available.length) return null;
                                            return (
                                                <div key={group.category}>
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{group.category}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {available.map(h => (
                                                            <button
                                                                key={h.title}
                                                                onClick={async () => {
                                                                    if (saving) return;
                                                                    setSaving(true);
                                                                    try {
                                                                        const res = await apiPost(`/api/students/${studentId}/habits`, { title: h.title, icon: h.icon });
                                                                        setHabits(prev => [...prev, res.habit]);
                                                                        setTeacherAddOpen(false);
                                                                    } catch (err: unknown) {
                                                                        alert(err instanceof Error ? err.message : 'Failed to add habit');
                                                                    } finally { setSaving(false); }
                                                                }}
                                                                disabled={saving}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors font-medium"
                                                            >
                                                                <span>{h.icon}</span> {h.title}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {teacherAddTab === 'custom' && (
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1.5">Choose an icon</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {MUSIC_ICONS.map(ic => (
                                                <button
                                                    key={ic}
                                                    onClick={() => setTeacherCustomIcon(ic)}
                                                    className={`text-xl rounded-lg p-1.5 ${teacherCustomIcon === ic ? 'bg-orange-100 ring-2 ring-orange-400' : 'hover:bg-slate-200'}`}
                                                >
                                                    {ic}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            placeholder="e.g. 30 min sitar practice"
                                            value={teacherCustomTitle}
                                            onChange={e => setTeacherCustomTitle(e.target.value)}
                                            onKeyDown={async e => {
                                                if (e.key !== 'Enter' || !teacherCustomTitle.trim() || saving) return;
                                                setSaving(true);
                                                try {
                                                    const res = await apiPost(`/api/students/${studentId}/habits`, { title: teacherCustomTitle.trim(), icon: teacherCustomIcon });
                                                    setHabits(prev => [...prev, res.habit]);
                                                    setTeacherCustomTitle(''); setTeacherAddOpen(false);
                                                } catch (err: unknown) {
                                                    alert(err instanceof Error ? err.message : 'Failed to add habit');
                                                } finally { setSaving(false); }
                                            }}
                                            maxLength={80}
                                        />
                                        <button
                                            onClick={async () => {
                                                if (!teacherCustomTitle.trim() || saving) return;
                                                setSaving(true);
                                                try {
                                                    const res = await apiPost(`/api/students/${studentId}/habits`, { title: teacherCustomTitle.trim(), icon: teacherCustomIcon });
                                                    setHabits(prev => [...prev, res.habit]);
                                                    setTeacherCustomTitle(''); setTeacherAddOpen(false);
                                                } catch (err: unknown) {
                                                    alert(err instanceof Error ? err.message : 'Failed to add habit');
                                                } finally { setSaving(false); }
                                            }}
                                            disabled={!teacherCustomTitle.trim() || saving}
                                            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}

                            {teacherAddTab === 'theory' && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-500">
                                        A theory habit presents this student with a daily music theory flash-card question when they check it off. You can mark their answers correct for +5 XP.
                                    </p>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Difficulty level</label>
                                        <select
                                            value={teacherTheoryLevel}
                                            onChange={e => setTeacherTheoryLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                        >
                                            <option value="beginner">Beginner</option>
                                            <option value="intermediate">Intermediate</option>
                                            <option value="advanced">Advanced</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (saving) return;
                                            setSaving(true);
                                            try {
                                                const res = await apiPost(`/api/students/${studentId}/habits`, {
                                                    title: 'Daily Theory Practice',
                                                    icon: '📖',
                                                    type: 'theory',
                                                    level: teacherTheoryLevel,
                                                });
                                                setHabits(prev => [...prev, res.habit]);
                                                setTeacherAddOpen(false);
                                            } catch (err: unknown) {
                                                alert(err instanceof Error ? err.message : 'Failed to add theory habit');
                                            } finally { setSaving(false); }
                                        }}
                                        disabled={saving}
                                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                                    >
                                        Assign Theory Habit
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HabitTrackerTab;
