/**
 * Simple event-based refresh system for cross-component state synchronization.
 *
 * Usage:
 * - In parent: useRefreshListener('devProjects', loadDevProjects)
 * - In child: triggerRefresh('devProjects')
 */

import { useEffect, useCallback } from 'react';

type RefreshEvent =
  | 'devProjects'
  | 'projects'
  | 'tasks'
  | 'files'
  | 'favorites'
  | 'recent'
  | 'all';

const REFRESH_EVENT = 'vault-refresh';

interface RefreshEventDetail {
  type: RefreshEvent;
}

/**
 * Trigger a refresh for a specific data type
 */
export function triggerRefresh(type: RefreshEvent = 'all'): void {
  window.dispatchEvent(new CustomEvent<RefreshEventDetail>(REFRESH_EVENT, {
    detail: { type }
  }));
}

/**
 * Hook to listen for refresh events and call a callback
 */
export function useRefreshListener(
  type: RefreshEvent | RefreshEvent[],
  callback: () => void | Promise<void>
): void {
  useEffect(() => {
    const types = Array.isArray(type) ? type : [type];

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<RefreshEventDetail>).detail;
      if (detail.type === 'all' || types.includes(detail.type)) {
        callback();
      }
    };

    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, [type, callback]);
}

/**
 * Hook that returns a refresh trigger function
 */
export function useRefreshTrigger(): (type?: RefreshEvent) => void {
  return useCallback((type: RefreshEvent = 'all') => {
    triggerRefresh(type);
  }, []);
}
