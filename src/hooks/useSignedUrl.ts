import { useEffect, useState } from 'react';
import { repo } from '../data/repository';

/** Already-displayable values: demo mode's data: URLs, object URLs, http(s). */
const IS_URL = /^(https?:|data:|blob:)/;

/**
 * Resolves a stored object path to something an <img> or <a> can use.
 *
 * Both storage buckets are private, so URLs are signed and expire after an
 * hour. That is why the database holds the *path* and the URL is minted here
 * at render time — persisting a signed URL would work until it quietly didn't.
 */
export function useSignedUrl(stored: string | undefined): string | undefined {
  // Derived during render, so no state update is needed for the common case.
  const direct = stored && IS_URL.test(stored) ? stored : undefined;
  const [entry, setEntry] = useState<{ key: string; url?: string } | null>(null);

  useEffect(() => {
    if (!stored || IS_URL.test(stored)) return;
    let live = true;
    void repo.signedUrl(stored).then(u => {
      if (live) setEntry({ key: stored, url: u ?? undefined });
    });
    return () => { live = false; };
  }, [stored]);

  // Keyed on `stored` so the previous person's photo can't flash while the
  // new one is still being signed.
  return direct ?? (entry && entry.key === stored ? entry.url : undefined);
}
