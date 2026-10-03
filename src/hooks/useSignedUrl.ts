import { useEffect, useState } from 'react';
import { repo } from '../data/repository';

/** Already-displayable values: demo mode's data: URLs, object URLs, http(s). */
const IS_URL = /^(https?:|data:|blob:)/;

/** Signed URLs last an hour; reuse one for 50 minutes, then sign afresh. */
const REUSE_MS = 50 * 60 * 1000;

const cache = new Map<string, { url: string | null; at: number }>();
const pending = new Map<string, Promise<string | null>>();

function cached(stored: string): string | null | undefined {
  const hit = cache.get(stored);
  return hit && Date.now() - hit.at < REUSE_MS ? hit.url : undefined;
}

/**
 * One signing request per path, however many components ask at once, and the
 * same URL handed out until it nears expiry. Reusing the URL is what lets the
 * browser serve a photo from its cache: a freshly signed URL is a new address,
 * so every re-sign used to mean downloading the image again.
 */
function sign(stored: string): Promise<string | null> {
  const inFlight = pending.get(stored);
  if (inFlight) return inFlight;
  const p = repo.signedUrl(stored)
    .then(url => { cache.set(stored, { url, at: Date.now() }); return url; })
    .catch(() => null)
    .finally(() => pending.delete(stored));
  pending.set(stored, p);
  return p;
}

/**
 * Resolves a stored object path to something an <img> or <a> can use.
 *
 * Both storage buckets are private, so URLs are signed and expire after an
 * hour. That is why the database holds the *path* and the URL is minted here
 * at render time — persisting a signed URL would work until it quietly didn't.
 */
export function useSignedUrl(stored: string | undefined): string | undefined {
  // Derived during render, so no state update is needed for the common cases:
  // a displayable URL, or a path signed earlier by any component.
  const direct = stored && IS_URL.test(stored) ? stored : undefined;
  const hit = stored && !direct ? cached(stored) : undefined;
  const [entry, setEntry] = useState<{ key: string; url?: string } | null>(null);

  useEffect(() => {
    if (!stored || IS_URL.test(stored) || cached(stored) !== undefined) return;
    let live = true;
    void sign(stored).then(u => {
      if (live) setEntry({ key: stored, url: u ?? undefined });
    });
    return () => { live = false; };
  }, [stored]);

  if (direct) return direct;
  if (hit !== undefined) return hit ?? undefined;
  // Keyed on `stored` so the previous person's photo can't flash while the
  // new one is still being signed.
  return entry && entry.key === stored ? entry.url : undefined;
}
