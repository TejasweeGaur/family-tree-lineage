import type { Driver } from 'driver.js';
import { treeTitle } from './treeTitle';

/**
 * Guided walkthrough, built on driver.js (MIT, ~20 KB). Loaded on demand so it
 * costs nothing for people who never open it.
 *
 * Steps point at `data-tour` attributes rather than labels or classes, so a
 * copy change can't silently break the tour. Steps whose element isn't on
 * screen (no cards yet, a viewer's hidden admin buttons) are skipped.
 */

interface TourStep {
  /** data-tour value to highlight; omit for a centred, element-less card. */
  target?: string;
  title: string;
  body: string;
  adminOnly?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

function steps(treeName: string): TourStep[] {
  // Touch screens tap and pinch; there's no Ctrl + scroll on a phone.
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const click = touch ? 'Tap' : 'Click';
  return [
    {
      title: `Welcome to the ${treeTitle(treeName)}`,
      body: `A quick look around — about a minute. You can leave at any time and replay it later from the ${touch ? 'menu' : 'footer'}.`,
    },
    {
      // Placement left to driver.js: the canvas fills most of the screen.
      target: 'canvas',
      title: 'The tree',
      body: `Each card is a person. ${click} a card for their profile — photos, documents, biography and family. ${click} a connecting line to highlight a whole branch. Drag to move around; ${touch ? 'pinch with two fingers to zoom' : 'Ctrl + scroll to zoom'}.`,
    },
    {
      target: 'card-plus', adminOnly: true,
      title: 'Add relatives from a card',
      body: 'The + on any card adds a spouse, child, parent or sibling, already linked to that person.',
    },
    {
      target: 'add-member', adminOnly: true,
      title: 'Add a member',
      body: 'Or add anyone from here. In a new, empty tree this is where you add the first person.',
    },
    {
      target: 'search',
      title: 'Search',
      body: 'Find people by name or place, and documents by title.',
    },
    {
      target: 'view-toggle',
      title: 'Tree or Directory',
      body: 'The Directory lists everyone as a table — including anyone the tree view doesn\'t draw, such as a married-in spouse\'s own parents.',
    },
    {
      target: 'on-this-day',
      title: 'On this day',
      body: 'Birthdays, anniversaries and remembrances for today and the coming month, plus a few family facts. The badge shows how many fall on today.',
    },
    {
      target: 'tree-switcher',
      title: 'Your trees',
      body: 'If you belong to more than one family tree, switch between them here — or start a new one of your own.',
    },
    {
      target: 'invite', adminOnly: true,
      title: 'Family access',
      body: 'Create invite links for relatives to join as viewers or admins, and see everyone who has access — change their role or remove them.',
    },
    {
      target: 'export',
      title: 'Export',
      body: 'Download the tree as a printable PDF chart, or everyone\'s details as an Excel spreadsheet.',
    },
    {
      target: 'data', adminOnly: true,
      title: 'Import and export CSV',
      body: 'Bring in a whole family from a spreadsheet (into an empty tree), or export one. Start from the template.',
    },
    {
      // Phones only: the desktop header shows these as separate buttons.
      target: 'mobile-menu',
      title: 'Everything else',
      body: 'On this day, inviting relatives, adding members, exports, CSV import and this tour are all in this menu.',
    },
    {
      target: 'tour-link',
      title: 'That\'s it',
      body: 'Replay this tour or read about the app from the footer whenever you like.',
    },
  ];
}

const seenKey = (userId: string) => `ft.tourSeen.${userId}`;

export function tourSeen(userId: string): boolean {
  try { return localStorage.getItem(seenKey(userId)) === '1'; } catch { return true; }
}

export function markTourSeen(userId: string): void {
  try { localStorage.setItem(seenKey(userId), '1'); } catch { /* storage unavailable: fine */ }
}

/**
 * The tour on screen, if any. Asking driver.js whether it is still active is
 * more reliable than a hand-kept flag: a flag reset only in onDestroyed got
 * stuck after the first run, and the tour then refused to start again.
 */
let current: Driver | null = null;
/** Only covers the moment between a click and drive(), while loading the library. */
let starting = false;

export async function runTour(opts: { isAdmin: boolean; treeName: string }): Promise<void> {
  if (starting || current?.isActive()) return;
  starting = true;
  try {
    const [{ driver }] = await Promise.all([
      import('driver.js'),
      import('driver.js/dist/driver.css'),
    ]);

    const visible = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      return !!el && el.getClientRects().length > 0;
    };

    const plan = steps(opts.treeName)
      .filter(s => opts.isAdmin || !s.adminOnly)
      .filter(s => !s.target || visible(`[data-tour="${s.target}"]`))
      .map(s => ({
        element: s.target ? `[data-tour="${s.target}"]` : undefined,
        popover: { title: s.title, description: s.body, side: s.side, align: 'start' as const },
      }));

    current = driver({
      steps: plan,
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      popoverClass: 'ft-tour',
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      smoothScroll: true,
    });
    current.drive();
  } finally {
    starting = false;
  }
}
