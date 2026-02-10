export enum ErrorCategory {
  AUTHENTICATION = 'AUTH',
  AUTHORIZATION = 'AUTHZ',
  VALIDATION = 'VALID',
  NETWORK = 'NET',
  TRADING = 'TRADE',
  WALLET = 'WALLET',
  API = 'API',
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

export enum ErrorCode {
  // Authentication errors (1000-1099)
  AUTH_NOT_LOGGED_IN = 'AUTH_1001',
  AUTH_SESSION_EXPIRED = 'AUTH_1002',
  AUTH_INVALID_CREDENTIALS = 'AUTH_1003',
  AUTH_WALLET_NOT_FOUND = 'AUTH_1004',
  AUTH_ORGANIZATION_NOT_FOUND = 'AUTH_1005',

  // Wallet errors (2000-2099)
  WALLET_ADDRESS_REQUIRED = 'WALLET_2001',
  WALLET_ADDRESS_INVALID = 'WALLET_2002',
  WALLET_NOT_AVAILABLE = 'WALLET_2003',
  WALLET_SIGNING_FAILED = 'WALLET_2004',
  WALLET_EVM_ADDRESS_NOT_FOUND = 'WALLET_2005',

  // Validation errors (3000-3099)
  VALID_MISSING_REQUIRED_FIELD = 'VALID_3001',
  VALID_INVALID_INPUT = 'VALID_3002',
  VALID_INVALID_ASSET = 'VALID_3003',
  VALID_INVALID_SIZE = 'VALID_3004',
  VALID_INVALID_PRICE = 'VALID_3005',
  VALID_INVALID_LEVERAGE = 'VALID_3006',

  // Trading errors (4000-4099)
  TRADE_POSITION_CREATE_FAILED = 'TRADE_4001',
  TRADE_POSITION_CLOSE_FAILED = 'TRADE_4002',
  TRADE_POSITION_NOT_FOUND = 'TRADE_4003',
  TRADE_INSUFFICIENT_BALANCE = 'TRADE_4004',
  TRADE_INVALID_ORDER = 'TRADE_4005',
  TRADE_LEVERAGE_UPDATE_FAILED = 'TRADE_4006',
  TRADE_LEVERAGE_FETCH_FAILED = 'TRADE_4007',
  TRADE_ORDER_CANCEL_FAILED = 'TRADE_4008',
  TRADE_TYPED_DATA_GENERATION_FAILED = 'TRADE_4009',

  // Network errors (5000-5099)
  NET_REQUEST_FAILED = 'NET_5001',
  NET_TIMEOUT = 'NET_5002',
  NET_CONNECTION_ERROR = 'NET_5003',
  NET_INVALID_RESPONSE = 'NET_5004',

  // API errors (6000-6099)
  API_BAD_REQUEST = 'API_6001',
  API_UNAUTHORIZED = 'API_6002',
  API_FORBIDDEN = 'API_6003',
  API_NOT_FOUND = 'API_6004',
  API_RATE_LIMIT = 'API_6005',
  API_SERVER_ERROR = 'API_6006',
  API_UNKNOWN_ERROR = 'API_6007',

  // HyperLiquid specific errors (7000-7099)
  HYPERLIQUID_SUBMIT_FAILED = 'HYPER_7001',
  HYPERLIQUID_INVALID_RESPONSE = 'HYPER_7002',
  HYPERLIQUID_SIGNING_FAILED = 'HYPER_7003',
  HYPERLIQUID_TYPED_DATA_FAILED = 'HYPER_7004',

  // Turnkey specific errors (8000-8099)
  TURNKEY_INIT_FAILED = 'TURNKEY_8001',
  TURNKEY_SIGNER_CREATE_FAILED = 'TURNKEY_8002',
  TURNKEY_SIGNATURE_FAILED = 'TURNKEY_8003',
  TURNKEY_CLIENT_INIT_FAILED = 'TURNKEY_8004',

  // Internal errors (9000-9099)
  INTERNAL_UNKNOWN_ERROR = 'INTERNAL_9001',
  INTERNAL_STATE_ERROR = 'INTERNAL_9002',
  INTERNAL_CONFIG_ERROR = 'INTERNAL_9003',
}

export interface ErrorMetadata {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  userMessage?: string; // User-friendly message
  statusCode?: number; // HTTP status code if applicable
  retryable?: boolean; // Whether the error is retryable
  context?: Record<string, unknown>; // Additional context
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly userMessage: string;

  constructor(metadata: ErrorMetadata, originalError?: Error) {
    super(metadata.message);
    this.name = 'AppError';
    this.code = metadata.code;
    this.category = metadata.category;
    this.statusCode = metadata.statusCode;
    this.retryable = metadata.retryable ?? false;
    this.context = metadata.context;
    this.userMessage = metadata.userMessage || metadata.message;

    // Preserve original error stack if available
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): {
    code: ErrorCode;
    category: ErrorCategory;
    message: string;
    userMessage: string;
    statusCode?: number;
    retryable: boolean;
    context?: Record<string, unknown>;
  } {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      retryable: this.retryable,
      context: this.context,
    };
  }
}

const ERROR_DEFINITIONS: Record<ErrorCode, Omit<ErrorMetadata, 'context'>> = {
  [ErrorCode.AUTH_NOT_LOGGED_IN]: {
    code: ErrorCode.AUTH_NOT_LOGGED_IN,
    category: ErrorCategory.AUTHENTICATION,
    message: 'User is not logged in',
    userMessage: 'Please log in to continue',
    statusCode: 401,
    retryable: false,
  },
  [ErrorCode.AUTH_SESSION_EXPIRED]: {
    code: ErrorCode.AUTH_SESSION_EXPIRED,
    category: ErrorCategory.AUTHENTICATION,
    message: 'Session has expired',
    userMessage: 'Your session has expired. Please log in again',
    statusCode: 401,
    retryable: false,
  },
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: {
    code: ErrorCode.AUTH_INVALID_CREDENTIALS,
    category: ErrorCategory.AUTHENTICATION,
    message: 'Invalid credentials provided',
    userMessage: 'Invalid credentials. Please try again',
    statusCode: 401,
    retryable: false,
  },
  [ErrorCode.AUTH_WALLET_NOT_FOUND]: {
    code: ErrorCode.AUTH_WALLET_NOT_FOUND,
    category: ErrorCategory.AUTHENTICATION,
    message: 'Wallet not found in user session',
    userMessage: 'Wallet not found. Please reconnect your wallet',
    statusCode: 404,
    retryable: false,
  },
  [ErrorCode.AUTH_ORGANIZATION_NOT_FOUND]: {
    code: ErrorCode.AUTH_ORGANIZATION_NOT_FOUND,
    category: ErrorCategory.AUTHENTICATION,
    message: 'Turnkey organization ID not found',
    userMessage: 'Authentication error. Please log in again',
    statusCode: 404,
    retryable: false,
  },

  // Wallet errors
  [ErrorCode.WALLET_ADDRESS_REQUIRED]: {
    code: ErrorCode.WALLET_ADDRESS_REQUIRED,
    category: ErrorCategory.WALLET,
    message: 'Wallet address is required',
    userMessage: 'Wallet address is required for this operation',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.WALLET_ADDRESS_INVALID]: {
    code: ErrorCode.WALLET_ADDRESS_INVALID,
    category: ErrorCategory.WALLET,
    message: 'Invalid wallet address format',
    userMessage: 'Invalid wallet address. Please check and try again',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.WALLET_NOT_AVAILABLE]: {
    code: ErrorCode.WALLET_NOT_AVAILABLE,
    category: ErrorCategory.WALLET,
    message: 'Wallet is not available',
    userMessage: 'Wallet is not available. Please connect your wallet',
    statusCode: 503,
    retryable: true,
  },
  [ErrorCode.WALLET_SIGNING_FAILED]: {
    code: ErrorCode.WALLET_SIGNING_FAILED,
    category: ErrorCategory.WALLET,
    message: 'Failed to sign transaction',
    userMessage: 'Transaction signing failed. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.WALLET_EVM_ADDRESS_NOT_FOUND]: {
    code: ErrorCode.WALLET_EVM_ADDRESS_NOT_FOUND,
    category: ErrorCategory.WALLET,
    message: 'EVM wallet address not found',
    userMessage: 'EVM wallet address not found. Please check your wallet connection',
    statusCode: 404,
    retryable: false,
  },

  // Validation errors
  [ErrorCode.VALID_MISSING_REQUIRED_FIELD]: {
    code: ErrorCode.VALID_MISSING_REQUIRED_FIELD,
    category: ErrorCategory.VALIDATION,
    message: 'Missing required field',
    userMessage: 'Please fill in all required fields',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.VALID_INVALID_INPUT]: {
    code: ErrorCode.VALID_INVALID_INPUT,
    category: ErrorCategory.VALIDATION,
    message: 'Invalid input provided',
    userMessage: 'Invalid input. Please check your values and try again',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.VALID_INVALID_ASSET]: {
    code: ErrorCode.VALID_INVALID_ASSET,
    category: ErrorCategory.VALIDATION,
    message: 'Invalid asset specified',
    userMessage: 'Invalid asset. Please select a valid asset',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.VALID_INVALID_SIZE]: {
    code: ErrorCode.VALID_INVALID_SIZE,
    category: ErrorCategory.VALIDATION,
    message: 'Invalid position size',
    userMessage: 'Invalid position size. Please enter a valid amount',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.VALID_INVALID_PRICE]: {
    code: ErrorCode.VALID_INVALID_PRICE,
    category: ErrorCategory.VALIDATION,
    message: 'Invalid price specified',
    userMessage: 'Invalid price. Please enter a valid price',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.VALID_INVALID_LEVERAGE]: {
    code: ErrorCode.VALID_INVALID_LEVERAGE,
    category: ErrorCategory.VALIDATION,
    message: 'Invalid leverage value',
    userMessage: 'Invalid leverage. Please enter a valid leverage value',
    statusCode: 400,
    retryable: false,
  },

  // Trading errors
  [ErrorCode.TRADE_POSITION_CREATE_FAILED]: {
    code: ErrorCode.TRADE_POSITION_CREATE_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to create position',
    userMessage: 'Failed to create position. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.TRADE_POSITION_CLOSE_FAILED]: {
    code: ErrorCode.TRADE_POSITION_CLOSE_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to close position',
    userMessage: 'Failed to close position. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.TRADE_POSITION_NOT_FOUND]: {
    code: ErrorCode.TRADE_POSITION_NOT_FOUND,
    category: ErrorCategory.TRADING,
    message: 'Position not found',
    userMessage: 'Position not found. It may have already been closed',
    statusCode: 404,
    retryable: false,
  },
  [ErrorCode.TRADE_INSUFFICIENT_BALANCE]: {
    code: ErrorCode.TRADE_INSUFFICIENT_BALANCE,
    category: ErrorCategory.TRADING,
    message: 'Insufficient balance for this operation',
    userMessage: 'Insufficient balance. Please deposit more funds',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.TRADE_INVALID_ORDER]: {
    code: ErrorCode.TRADE_INVALID_ORDER,
    category: ErrorCategory.TRADING,
    message: 'Invalid order parameters',
    userMessage: 'Invalid order. Please check your order parameters',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED]: {
    code: ErrorCode.TRADE_LEVERAGE_UPDATE_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to update leverage',
    userMessage: 'Failed to update leverage. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.TRADE_LEVERAGE_FETCH_FAILED]: {
    code: ErrorCode.TRADE_LEVERAGE_FETCH_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to fetch user leverage',
    userMessage: 'Failed to fetch leverage. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.TRADE_ORDER_CANCEL_FAILED]: {
    code: ErrorCode.TRADE_ORDER_CANCEL_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to cancel order',
    userMessage: 'Failed to cancel order. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.TRADE_TYPED_DATA_GENERATION_FAILED]: {
    code: ErrorCode.TRADE_TYPED_DATA_GENERATION_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to generate typed data for signing',
    userMessage: 'Failed to prepare transaction. Please try again',
    statusCode: 500,
    retryable: true,
  },

  // Network errors
  [ErrorCode.NET_REQUEST_FAILED]: {
    code: ErrorCode.NET_REQUEST_FAILED,
    category: ErrorCategory.NETWORK,
    message: 'Network request failed',
    userMessage: 'Network request failed. Please check your connection',
    statusCode: 0,
    retryable: true,
  },
  [ErrorCode.NET_TIMEOUT]: {
    code: ErrorCode.NET_TIMEOUT,
    category: ErrorCategory.NETWORK,
    message: 'Request timeout',
    userMessage: 'Request timed out. Please try again',
    statusCode: 408,
    retryable: true,
  },
  [ErrorCode.NET_CONNECTION_ERROR]: {
    code: ErrorCode.NET_CONNECTION_ERROR,
    category: ErrorCategory.NETWORK,
    message: 'Connection error',
    userMessage: 'Connection error. Please check your internet connection',
    statusCode: 0,
    retryable: true,
  },
  [ErrorCode.NET_INVALID_RESPONSE]: {
    code: ErrorCode.NET_INVALID_RESPONSE,
    category: ErrorCategory.NETWORK,
    message: 'Invalid response from server',
    userMessage: 'Invalid response. Please try again',
    statusCode: 502,
    retryable: true,
  },

  // API errors
  [ErrorCode.API_BAD_REQUEST]: {
    code: ErrorCode.API_BAD_REQUEST,
    category: ErrorCategory.API,
    message: 'Bad request',
    userMessage: 'Invalid request. Please check your input',
    statusCode: 400,
    retryable: false,
  },
  [ErrorCode.API_UNAUTHORIZED]: {
    code: ErrorCode.API_UNAUTHORIZED,
    category: ErrorCategory.API,
    message: 'Unauthorized',
    userMessage: 'Unauthorized. Please log in again',
    statusCode: 401,
    retryable: false,
  },
  [ErrorCode.API_FORBIDDEN]: {
    code: ErrorCode.API_FORBIDDEN,
    category: ErrorCategory.API,
    message: 'Forbidden',
    userMessage: 'You do not have permission to perform this action',
    statusCode: 403,
    retryable: false,
  },
  [ErrorCode.API_NOT_FOUND]: {
    code: ErrorCode.API_NOT_FOUND,
    category: ErrorCategory.API,
    message: 'Resource not found',
    userMessage: 'Resource not found',
    statusCode: 404,
    retryable: false,
  },
  [ErrorCode.API_RATE_LIMIT]: {
    code: ErrorCode.API_RATE_LIMIT,
    category: ErrorCategory.API,
    message: 'Rate limit exceeded',
    userMessage: 'Too many requests. Please wait a moment and try again',
    statusCode: 429,
    retryable: true,
  },
  [ErrorCode.API_SERVER_ERROR]: {
    code: ErrorCode.API_SERVER_ERROR,
    category: ErrorCategory.API,
    message: 'Server error',
    userMessage: 'Server error. Please try again later',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.API_UNKNOWN_ERROR]: {
    code: ErrorCode.API_UNKNOWN_ERROR,
    category: ErrorCategory.API,
    message: 'Unknown API error',
    userMessage: 'An unexpected error occurred. Please try again',
    statusCode: 500,
    retryable: true,
  },

  // HyperLiquid specific errors
  [ErrorCode.HYPERLIQUID_SUBMIT_FAILED]: {
    code: ErrorCode.HYPERLIQUID_SUBMIT_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to submit to HyperLiquid',
    userMessage: 'Failed to submit transaction to HyperLiquid. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.HYPERLIQUID_INVALID_RESPONSE]: {
    code: ErrorCode.HYPERLIQUID_INVALID_RESPONSE,
    category: ErrorCategory.TRADING,
    message: 'Invalid response from HyperLiquid',
    userMessage: 'Invalid response from HyperLiquid. Please try again',
    statusCode: 502,
    retryable: true,
  },
  [ErrorCode.HYPERLIQUID_SIGNING_FAILED]: {
    code: ErrorCode.HYPERLIQUID_SIGNING_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to sign HyperLiquid transaction',
    userMessage: 'Failed to sign transaction. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.HYPERLIQUID_TYPED_DATA_FAILED]: {
    code: ErrorCode.HYPERLIQUID_TYPED_DATA_FAILED,
    category: ErrorCategory.TRADING,
    message: 'Failed to generate HyperLiquid typed data',
    userMessage: 'Failed to prepare transaction. Please try again',
    statusCode: 500,
    retryable: true,
  },

  // Turnkey specific errors
  [ErrorCode.TURNKEY_INIT_FAILED]: {
    code: ErrorCode.TURNKEY_INIT_FAILED,
    category: ErrorCategory.WALLET,
    message: 'Failed to initialize Turnkey client',
    userMessage: 'Failed to initialize wallet. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.TURNKEY_SIGNER_CREATE_FAILED]: {
    code: ErrorCode.TURNKEY_SIGNER_CREATE_FAILED,
    category: ErrorCategory.WALLET,
    message: 'Failed to create Turnkey signer',
    userMessage: 'Failed to create wallet signer. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.TURNKEY_SIGNATURE_FAILED]: {
    code: ErrorCode.TURNKEY_SIGNATURE_FAILED,
    category: ErrorCategory.WALLET,
    message: 'Failed to sign with Turnkey',
    userMessage: 'Failed to sign transaction. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.TURNKEY_CLIENT_INIT_FAILED]: {
    code: ErrorCode.TURNKEY_CLIENT_INIT_FAILED,
    category: ErrorCategory.WALLET,
    message: 'Failed to initialize Turnkey IndexedDB client',
    userMessage: 'Failed to initialize wallet client. Please try again',
    statusCode: 500,
    retryable: true,
  },

  // Internal errors
  [ErrorCode.INTERNAL_UNKNOWN_ERROR]: {
    code: ErrorCode.INTERNAL_UNKNOWN_ERROR,
    category: ErrorCategory.INTERNAL,
    message: 'Unknown internal error',
    userMessage: 'An unexpected error occurred. Please try again',
    statusCode: 500,
    retryable: true,
  },
  [ErrorCode.INTERNAL_STATE_ERROR]: {
    code: ErrorCode.INTERNAL_STATE_ERROR,
    category: ErrorCategory.INTERNAL,
    message: 'Internal state error',
    userMessage: 'An internal error occurred. Please refresh the page',
    statusCode: 500,
    retryable: false,
  },
  [ErrorCode.INTERNAL_CONFIG_ERROR]: {
    code: ErrorCode.INTERNAL_CONFIG_ERROR,
    category: ErrorCategory.INTERNAL,
    message: 'Configuration error',
    userMessage: 'Configuration error. Please contact support',
    statusCode: 500,
    retryable: false,
  },
};

/**
 * Create an AppError from an error code
 * @param code - Error code
 * @param context - Additional context to include
 * @param originalError - Original error if wrapping
 * @returns AppError instance
 */
export function createError(
  code: ErrorCode,
  context?: Record<string, unknown>,
  originalError?: Error
): AppError {
  const definition = ERROR_DEFINITIONS[code];
  return new AppError(
    {
      ...definition,
      context: context ?? undefined,
    },
    originalError
  );
}

/**
 * Create an error with a custom message
 * @param code - Error code
 * @param customMessage - Custom error message
 * @param context - Additional context
 * @param originalError - Original error if wrapping
 * @returns AppError instance
 */
export function createErrorWithMessage(
  code: ErrorCode,
  customMessage: string,
  context?: Record<string, unknown>,
  originalError?: Error
): AppError {
  const definition = ERROR_DEFINITIONS[code];
  return new AppError(
    {
      ...definition,
      message: customMessage,
      context: context ?? undefined,
    },
    originalError
  );
}

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 * Useful for error handling where error type is unknown
 */
export function toAppError(
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.INTERNAL_UNKNOWN_ERROR
): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createError(defaultCode, { originalMessage: error.message }, error);
  }

  return createError(defaultCode, { unknownError: error });
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (isAppError(error)) {
    return error.retryable;
  }

  // Network errors are generally retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  return false;
}
