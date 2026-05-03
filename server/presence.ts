import type { WebSocket as WSType } from "ws";

export type PresenceWsMeta = {
  spaceId: string | null;
  userId: string | null;
  isAlive: boolean;
};

export type PresenceChangedMessage = {
  type: "presence_changed";
  data: { spaceId: string; count: number };
};

export function getPresenceForSpace(
  spaceId: string,
  clients: Map<string, Set<WSType>>,
  wsMeta: WeakMap<WSType, PresenceWsMeta>,
): { count: number; userIds: string[] } {
  const set = clients.get(spaceId);
  if (!set) return { count: 0, userIds: [] };
  const userIds = new Set<string>();
  set.forEach((sock) => {
    const meta = wsMeta.get(sock);
    if (meta?.userId) userIds.add(meta.userId);
  });
  return { count: set.size, userIds: Array.from(userIds) };
}

export function buildPresenceChangedMessage(
  spaceId: string,
  count: number,
): PresenceChangedMessage {
  return { type: "presence_changed", data: { spaceId, count } };
}
