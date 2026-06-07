import type { WsOut } from "../../../shared/types";

let socket: WebSocket | null = null;

export function getSocket(): WebSocket | null {
  return socket;
}

export function setSocket(s: WebSocket | null): void {
  socket = s;
}

export function isSocketOpen(): boolean {
  return socket?.readyState === WebSocket.OPEN;
}

export function wsSend(out: WsOut): void {
  if (isSocketOpen()) socket!.send(JSON.stringify(out));
}
