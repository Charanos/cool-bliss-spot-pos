/**
 * A refusal a person can read. Services throw this when a command breaks a rule, with a sentence in
 * the docs/08 voice: what happened, then what to do. Anything else that escapes a service is an
 * internal failure, and its message never reaches a screen.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Whether an error carries a message written for people (a DomainError, a sync refusal, a reason check). */
export function isUserFacing(error: unknown): error is Error {
  return error instanceof Error && (error.name === 'DomainError' || error.name === 'CommandRejected' || error.name === 'ReasonError');
}
