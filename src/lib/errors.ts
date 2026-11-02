export class AppError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  GYM_SUSPENDED: 'This gym is suspended. Contact FitDesk support.',
  AUTH_REQUIRED: 'Your session has expired. Please sign in again.',
  ADMIN_REQUIRED: 'This account does not have admin access.',
  GYM_NOT_FOUND: 'The gym could not be found.',
  INVALID_UPI_ID: 'Enter a valid UPI ID, for example gym@okhdfcbank.',
  QR_PATH_GYM_MISMATCH: 'That QR file does not belong to this gym.',
  INVALID_PACKAGE_MONTHS: 'Duration must be between 1 and 24 months.',
  INVALID_PACKAGE_PRICE: 'Enter a price greater than zero.',
  PACKAGE_NOT_FOUND: 'That package could not be found.',
  PAST_DATE_NOT_EDITABLE: 'Past dates cannot be changed from the calendar.',
  INVALID_ROTATION_INTERVAL: 'Choose a rotation interval of 1, 3, 6, or 12 months.',
  PAYMENT_NOT_FOUND: 'That payment could not be found.',
  PAYMENT_ALREADY_REVIEWED: 'This payment has already been reviewed.',
  PAYMENT_NOT_SUBMITTED: 'This payment has not been submitted yet.',
  PAYMENT_QUOTE_MISMATCH: 'The payment does not match its quoted package.',
  PAYMENT_AMOUNT_MISMATCH: 'The payment amount is inconsistent. Please check it manually.',
  DATE_REQUIRED: 'Choose a date first.',
  INVALID_DOCUMENT_PATH: 'The document path is invalid.',
  DOCUMENT_NOT_UPLOADED: 'The document upload did not finish. Please try again.',
  INVALID_DATE_OF_BIRTH: 'Date of birth cannot be in the future.',
}

function extractCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const record = error as Record<string, unknown>
  const candidates = [record.code, record.message, record.details, record.hint]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const known = Object.keys(FRIENDLY_MESSAGES).find((key) => candidate.includes(key))
    if (known) return known
  }
  return null
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error

  const code = extractCode(error)
  if (code) return new AppError(code, FRIENDLY_MESSAGES[code] ?? errorMessage(error))

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const message =
      typeof record.message === 'string'
        ? record.message
        : typeof record.error_description === 'string'
          ? record.error_description
          : null
    if (message) {
      if (/invalid login credentials/i.test(message)) {
        return new AppError('INVALID_CREDENTIALS', 'The email or password is incorrect.')
      }
      if (/failed to fetch|network/i.test(message)) {
        return new AppError('NETWORK', 'Could not reach FitDesk. Check your connection and retry.')
      }
      return new AppError('UNKNOWN', message)
    }
  }

  return new AppError('UNKNOWN', 'Something went wrong. Please try again.')
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  return 'Something went wrong. Please try again.'
}
