import type { Message, SessionItem } from '../types';

interface SessionState {
  sessionId: string | null;
  messages: Message[];
  sessions: SessionItem[];
  domainMode: string | null;
  domainModeEpoch: number;
  isStreaming: boolean;
}
interface Dependencies {
  getState: () => SessionState;
  publish: (state: Partial<SessionState> & { documentId?: null }) => void;
  list: (collectionId: string) => Promise<{ sessions: SessionItem[] }>;
  messages: (sessionId: string) => Promise<{ messages: Message[] }>;
  create: (collectionId: string) => Promise<{
    session_id: string; collection_id: string; title: string | null; created_at: string;
  }>;
  isCurrent: () => boolean;
  onError: (failed: boolean) => void;
}

// The controller belongs to one mounted workspace. A newer intent invalidates
// every older response; session identity and transcript have one store write.
export function createCollectionSessions(collectionId: string, deps: Dependencies) {
  let disposed = false;
  let epoch = 0;
  let creating = false;
  let failedIntent: (() => Promise<void>) | null = null;
  const current = (token: number) => !disposed && deps.isCurrent() && token === epoch;
  const restoredMode = (mode: string | null | undefined, selectionEpoch: number) => {
    const state = deps.getState();
    return state.domainModeEpoch === selectionEpoch
      ? (mode === 'legal' || mode === 'academic' ? mode : null) : state.domainMode;
  };
  const begin = () => {
    failedIntent = null;
    deps.onError(false);
    return ++epoch;
  };
  async function open(sessionId: string) {
    if (disposed || !deps.isCurrent() || creating || deps.getState().isStreaming) return;
    const token = begin();
    const selectionEpoch = deps.getState().domainModeEpoch;
    try {
      const result = await deps.messages(sessionId);
      if (current(token) && !deps.getState().isStreaming) deps.publish({
        sessionId, messages: result.messages,
        domainMode: restoredMode(deps.getState().sessions.find(row => row.session_id === sessionId)?.domain_mode, selectionEpoch),
      });
    } catch {
      if (current(token)) { failedIntent = () => open(sessionId); deps.onError(true); }
    }
  }
  async function create(token: number, selectionEpoch = deps.getState().domainModeEpoch) {
    creating = true;
    try {
      const result = await deps.create(collectionId);
      if (!current(token)) return;
      if (result.collection_id !== collectionId) throw new Error('Wrong collection session');
      const now = result.created_at || new Date().toISOString();
      const row: SessionItem = {
        session_id: result.session_id, title: result.title, message_count: 0, domain_mode: null,
        created_at: now, last_activity_at: now,
      };
      const sessions = [row, ...deps.getState().sessions];
      // A send may start on the still-visible conversation during creation.
      // Keep the created server row listed, but never orphan that stream.
      if (deps.getState().isStreaming) { deps.publish({ sessions }); return; }
      deps.publish({ sessionId: row.session_id, messages: [], sessions, domainMode: restoredMode(null, selectionEpoch) });
    } catch {
      if (current(token)) { failedIntent = () => newSession(); deps.onError(true); }
    } finally {
      creating = false;
    }
  }
  async function initialize() {
    if (disposed || !deps.isCurrent() || creating || deps.getState().isStreaming) return;
    const token = begin();
    const selectionEpoch = deps.getState().domainModeEpoch;
    try {
      const result = await deps.list(collectionId);
      if (!current(token)) return;
      deps.publish({ sessions: result.sessions });
      if (!result.sessions.length) {
        await create(token, selectionEpoch);
        return;
      }
      const sessionId = result.sessions[0].session_id;
      const transcript = await deps.messages(sessionId);
      if (current(token) && !deps.getState().isStreaming) deps.publish({
        sessionId, messages: transcript.messages,
        domainMode: restoredMode(deps.getState().sessions.find(row => row.session_id === sessionId)?.domain_mode, selectionEpoch),
      });
    } catch {
      // A failed list/restore is not evidence of an empty collection. Never
      // create a replacement on transient failure; leave the prior pair intact.
      if (current(token)) { failedIntent = initialize; deps.onError(true); }
    }
  }
  async function newSession() {
    if (disposed || !deps.isCurrent() || creating || deps.getState().isStreaming) return;
    await create(begin());
  }
  return {
    async retry() {
      if (disposed || !deps.isCurrent()) return;
      await failedIntent?.();
    },
    activate() { disposed = false; ++epoch; },
    initialize,
    open,
    newSession,
    dispose() { disposed = true; ++epoch; },
  };
}
