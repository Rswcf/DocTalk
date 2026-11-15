// One visit per page load, including client-side navigation. No cookies or storage.
// Reader identifiers stay in memory; only independent random analytics IDs leave it.
import type { DemoOrigin } from './demoEntry';

type Step = 'question' | 'answer' | 'citation' | 'source';
type Attempt = { id: string; steps: Set<Step> };
let visit: string | undefined;
const attempts = new Map<string, Attempt>();

function emit(step: 'entry' | Step, attempt?: string) {
  const origin: DemoOrigin = window.docTalkDemoOrigin || { landing: '/*', source: 'direct_unknown', qa: false };
  const body = JSON.stringify({ event_name: 'demo_trial', properties: {
    step, visit, attempt, landing_path: origin.landing, source: origin.source, qa: origin.qa,
  } });
  const send = () => fetch('/api/proxy/api/events', { method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json' }, body });
  void send().then(r => { if (r.status >= 500) return send(); }, send).catch(() => undefined);
}

export function enterDemo() {
  if (visit || typeof window === 'undefined' || !window.crypto?.randomUUID) return;
  visit = window.crypto.randomUUID();
  emit('entry');
}

export function demoQuestion(session: string, message: string) {
  enterDemo();
  if (!visit) return;
  const key = session + '/' + message;
  const attempt = { id: crypto.randomUUID(), steps: new Set<Step>(['question']) };
  attempts.set(key, attempt);
  emit('question', attempt.id);
}

export function linkDemoAnswer(session: string, localId: string, backendId: string) {
  const attempt = attempts.get(session + '/' + localId);
  if (attempt) attempts.set(session + '/' + backendId, attempt);
}

export function demoStep(session: string | null, message: string | undefined, step: Exclude<Step, 'question'>) {
  const attempt = attempts.get(session + '/' + message);
  const previous = { answer: 'question', citation: 'question', source: 'citation' } as const;
  if (!attempt || !attempt.steps.has(previous[step]) || attempt.steps.has(step)) return;
  attempt.steps.add(step);
  emit(step, attempt.id);
}
