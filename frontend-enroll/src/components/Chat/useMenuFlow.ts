import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../../api';
import { MenuArea, MenuData, MenuItem, MenuStep, QuickReplyChip } from './chatTypes';

interface ChatActions {
  addBotText: (text: string, chips?: QuickReplyChip[]) => string;
  addUserText: (text: string) => string;
  removeMessages: (ids: string[]) => void;
  runAction: (label: string, skill: string, params: Record<string, string>) => Promise<void>;
  setArea: (area: string | null) => void;
  setChips: (chips: QuickReplyChip[]) => void;
}

interface Flow {
  area: MenuArea;
  item: MenuItem;
  answers: Record<string, string>;
  params: Record<string, string>;
  labels: string[];
  /** The step waiting for a typed answer, if any */
  awaiting: MenuStep | null;
  /** Question and typed-answer messages shown so far; removed when the flow ends */
  shown: string[];
}

const matches = (step: MenuStep, answers: Record<string, string>) =>
  !step.when || Object.entries(step.when).every(([k, v]) => answers[k] === v);

const nextStep = (item: MenuItem, answers: Record<string, string>) =>
  (item.ask ?? []).find(st => answers[st.id] === undefined && matches(st, answers));

// Drives the menu: loads it, and walks one option's questions (chips, or a typed answer) before
// running its skill. Each answer is local; only the finished choice goes to the server.
export function useMenuFlow(actions: ChatActions) {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [awaitingText, setAwaitingText] = useState(false);
  const flow = useRef<Flow | null>(null);
  // Always the latest callbacks, so chips created earlier never call stale ones
  const act = useRef(actions);
  act.current = actions;
  const menuRef = useRef<MenuData | null>(null);
  menuRef.current = menu;

  useEffect(() => {
    let alive = true;
    apiGet('/api/chat/menu')
      .then((data: MenuData) => { if (alive && Array.isArray(data?.areas)) setMenu(data); })
      .catch(() => { /* no menu: the chat still works by typing */ });
    return () => { alive = false; };
  }, []);

  const setFlow = (f: Flow | null) => {
    flow.current = f;
    setAwaitingText(!!f?.awaiting);
  };

  const areaChips = useCallback((area: MenuArea): QuickReplyChip[] =>
    area.items.map(item => ({ label: item.label, value: item.label, onSelect: () => start(area, item) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const cancel = useCallback(() => {
    const f = flow.current;
    setFlow(null);
    if (f) {
      act.current.removeMessages(f.shown);
      act.current.addBotText('Okay, cancelled.', areaChips(f.area));
    }
  }, [areaChips]);

  const finish = (f: Flow) => {
    const params = { ...(f.item.params ?? {}), ...f.params };
    const label = [`${f.area.label} › ${f.item.label}`, ...f.labels].join(' · ');
    setFlow(null);
    act.current.removeMessages(f.shown);
    void act.current.runAction(label, f.item.skill, params);
  };

  const answer = (f: Flow, step: MenuStep, value: string, label: string, extra?: Record<string, string>) => {
    f.answers[step.id] = value;
    if (step.param) f.params[step.param] = value;
    if (extra) Object.assign(f.params, extra);
    f.labels.push(label);
    f.awaiting = null;
    ask(f);
  };

  const say = (f: Flow, text: string, chips: QuickReplyChip[]) => { f.shown.push(act.current.addBotText(text, chips)); };

  const cancelChip = (): QuickReplyChip => ({ label: '✕ Cancel', value: 'cancel', onSelect: cancel });

  const optionChips = (f: Flow, step: MenuStep, options: { label: string; value: string; params?: Record<string, string> }[]) =>
    [...options.map(o => ({
      label: o.label, value: o.value, onSelect: () => answer(f, step, o.value, o.label, o.params),
    })), cancelChip()];

  const askText = (f: Flow, step: MenuStep, prompt: string) => {
    f.awaiting = step;
    setFlow(f);
    say(f, prompt, [cancelChip()]);
  };

  // Ask the next unanswered step, or run the skill when everything is answered
  const ask = (f: Flow) => {
    const step = nextStep(f.item, f.answers);
    if (!step) { finish(f); return; }
    setFlow(f);
    const options = menuRef.current?.options;
    switch (step.kind) {
      case 'choice':
        say(f, step.prompt, optionChips(f, step, step.options ?? []));
        return;
      case 'date':
        say(f, step.prompt, [
          ...optionChips(f, step, [{ label: 'Today', value: 'today' }, { label: 'Yesterday', value: 'yesterday' }]).slice(0, 2),
          { label: 'Another day…', value: 'other', onSelect: () => askText(f, step, 'Type the date, e.g. 28 Oct or 2026-10-28.') },
          cancelChip(),
        ]);
        return;
      case 'instrument':
        say(f, step.prompt, optionChips(f, step, (options?.instruments ?? []).map(n => ({ label: n, value: n }))));
        return;
      case 'teacher':
        say(f, step.prompt, optionChips(f, step, (options?.teachers ?? []).map(n => ({ label: n, value: n }))));
        return;
      default: // student, text
        askText(f, step, step.prompt);
    }
  };

  const start = (area: MenuArea, item: MenuItem) => {
    act.current.setArea(area.id);
    if (item.type === 'guide') {
      setFlow(null);
      act.current.addBotText(item.guide ?? `Tell me what you'd like to do with "${item.label}".`);
      return;
    }
    ask({ area, item, answers: {}, params: {}, labels: [], awaiting: null, shown: [] });
  };

  // A typed message while a question waits for text answers it. Typing anything else while chips
  // are showing abandons the flow. Returns true when the message was consumed here.
  const consumeTyped = useCallback((text: string): boolean => {
    const f = flow.current;
    if (!f) return false;
    const step = f.awaiting;
    if (!step) { setFlow(null); act.current.removeMessages(f.shown); return false; }
    const value = text.trim();
    if (!value) return true;
    f.shown.push(act.current.addUserText(value));
    answer(f, step, value, value);
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick an area from the menu: say so and offer its options as chips
  const selectArea = useCallback((area: MenuArea) => {
    setFlow(null);
    act.current.setArea(area.id);
    act.current.addBotText(`${area.label}: what would you like to do?`, areaChips(area));
  }, [areaChips]);

  return { menu, awaitingText, start, selectArea, consumeTyped, cancel };
}
