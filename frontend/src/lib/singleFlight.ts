export interface SingleFlightLatch {
  current: boolean;
}

/** Acquire a synchronous latch before any async work or accounting mutation. */
export function acquireSingleFlight(
  latch: SingleFlightLatch,
  isAlreadyBusy: () => boolean,
): (() => void) | null {
  if (latch.current || isAlreadyBusy()) return null;

  latch.current = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    latch.current = false;
  };
}
