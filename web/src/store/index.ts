import { atom, createStore } from 'jotai';

export const store = createStore();

export type GlobalMessageType = 'success' | 'error' | 'info' | 'warning';

export interface GlobalMessage {
  id: number;
  type: GlobalMessageType;
  text: string;
  durationMs: number;
  onClick?: () => void;
}

export interface ShowGlobalMessageInput {
  type: GlobalMessageType;
  text: string;
  durationMs?: number;
  onClick?: () => void;
}

const DEFAULT_GLOBAL_MESSAGE_DURATION = 2600;
let globalMessageId = 0;

export const globalMessageAtom = atom<GlobalMessage | null>(null);

export function showGlobalMessage(input: ShowGlobalMessageInput) {
  const id = ++globalMessageId;
  store.set(globalMessageAtom, {
    id,
    type: input.type,
    text: input.text,
    durationMs: Math.max(0, input.durationMs ?? DEFAULT_GLOBAL_MESSAGE_DURATION),
    onClick: input.onClick,
  });
  return id;
}

export function hideGlobalMessage(id?: number) {
  const current = store.get(globalMessageAtom);
  if (!current) return;
  if (typeof id === 'number' && current.id !== id) return;
  store.set(globalMessageAtom, null);
}
