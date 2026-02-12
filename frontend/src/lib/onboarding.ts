import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_KEY = 'doctalk_tour_completed';

export function shouldShowTour(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !localStorage.getItem(TOUR_STORAGE_KEY);
  } catch {
    return false; // localStorage unavailable in private browsing
  }
}

export function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {} // localStorage unavailable in private browsing
}

export function startOnboardingTour(
  t: (key: string) => string,
  options?: { showModeSelector?: boolean }
) {
  // Skip on mobile — layout is different with tabs
  if (typeof window !== 'undefined' && window.innerWidth < 640) return;

  const steps: Array<{ element: string; popover: { title: string; description: string; side: 'left' | 'right' | 'top' | 'bottom' } }> = [
    {
      element: '[data-tour="chat-area"]',
      popover: {
        title: t('tour.citation.title'),
        description: t('tour.citation.desc'),
        side: 'left',
      },
    },
  ];

  if (options?.showModeSelector !== false) {
    steps.push({
      element: '[data-tour="mode-selector"]',
      popover: {
        title: t('tour.mode.title'),
        description: t('tour.mode.desc'),
        side: 'bottom',
      },
    });
  }

  steps.push(
    {
      element: '[data-tour="plus-menu"]',
      popover: {
        title: t('tour.plus.title'),
        description: t('tour.plus.desc'),
        side: 'top',
      },
    },
    {
      element: '[data-tour="session-dropdown"]',
      popover: {
        title: t('tour.session.title'),
        description: t('tour.session.desc'),
        side: 'bottom',
      },
    },
  );

  const d = driver({
    showProgress: true,
    steps,
    onDestroyed: () => {
      markTourCompleted();
    },
    popoverClass: 'doctalk-tour-popover',
  });

  d.drive();
}
