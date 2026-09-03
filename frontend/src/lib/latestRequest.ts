export interface LatestRequestScope {
  latestRequestOrdinal: number;
}

export interface RequestOrdinalRef {
  current: number;
}

export interface LatestRequestTicket<TScope extends LatestRequestScope> {
  scope: TScope;
  ordinal: number;
}

/** Mark a request as the newest request started for its logical scope. */
export function beginLatestRequest<TScope extends LatestRequestScope>(
  scope: TScope,
  nextOrdinal: RequestOrdinalRef,
): LatestRequestTicket<TScope> {
  nextOrdinal.current += 1;
  scope.latestRequestOrdinal = nextOrdinal.current;
  return { scope, ordinal: nextOrdinal.current };
}

/** Accept a result only while both its scope and start ordinal are current. */
export function isLatestRequest<TScope extends LatestRequestScope>(
  currentScope: TScope,
  ticket: LatestRequestTicket<TScope>,
): boolean {
  return currentScope === ticket.scope
    && currentScope.latestRequestOrdinal === ticket.ordinal;
}
