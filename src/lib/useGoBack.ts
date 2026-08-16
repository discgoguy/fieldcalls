import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Back navigation that mirrors the browser Back button: pop history when we arrived from
 * within the app (so the origin's URL state — filters, tab, scroll — is restored), else
 * go to `fallback`. react-router keeps the stack index in window.history.state.idx
 * (0 on a direct entry: deep link, refresh, new tab), where navigate(-1) would leave the app.
 * On a direct entry with no `fallback` we stay put rather than walk the user out of the SPA.
 */
export function useGoBack(fallback?: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state?.idx as number | undefined) ?? 0;
    if (idx > 0) navigate(-1);
    else if (fallback) navigate(fallback);
  }, [navigate, fallback]);
}
