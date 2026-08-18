import { httpStatus, publicMessage, type ReasonCode } from './reason-codes.js';

export class ApiError extends Error {
  readonly code: ReasonCode;
  readonly status: number;
  readonly publicMessage: string;
  readonly internalCode: ReasonCode;

  constructor(code: ReasonCode, internalCode: ReasonCode = code) {
    super(publicMessage(code));
    this.name = 'ApiError';
    this.code = code;
    this.internalCode = internalCode;
    this.status = httpStatus(code);
    this.publicMessage = publicMessage(code);
  }

  toJSON(): { error: { code: ReasonCode; message: string } } {
    return { error: { code: this.code, message: this.publicMessage } };
  }
}

export function leakSafe(internal: ReasonCode): ApiError {
  if (internal === 'WRONG_USER' || internal === 'FORBIDDEN' || internal === 'ATTEMPT_NOT_FOUND') {
    return new ApiError('ATTEMPT_NOT_FOUND', internal);
  }
  return new ApiError(internal);
}
