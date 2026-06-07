import { useEffect, useRef } from 'react';

/**
 * Subscribes to messages posted from the extension host
 * (`webview.postMessage`). The handler is held in a ref so callers can pass an
 * inline closure without re-subscribing on every render.
 */
export function useHostMessage<TMessage>(handler: (message: TMessage) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (event: MessageEvent): void => {
      handlerRef.current(event.data as TMessage);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
}
