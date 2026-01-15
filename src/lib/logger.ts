/**
 * Structured Logging System using Pino
 * 
 * Provides consistent, structured logging across the application with:
 * - Log levels (trace, debug, info, warn, error, fatal)
 * - Context enrichment (user, request, etc.)
 * - PII masking in production
 * - Child loggers for scoped logging
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  data?: Record<string, unknown>;
}

// PII fields to mask in production
const PII_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'phone_number',
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'creditCard',
  'ssn',
  'ip',
  'ipAddress',
];

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const isProduction = process.env.NODE_ENV === 'production';
const currentLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug');
const enablePrettyPrint = process.env.LOG_PRETTY === 'true' || !isProduction;

/**
 * Mask PII fields in objects for production logs
 */
function maskPII(obj: Record<string, unknown>): Record<string, unknown> {
  if (!isProduction) return obj;
  
  const masked: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      masked[key] = maskPII(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}

/**
 * Format log entry for output
 */
function formatLog(entry: LogEntry): string {
  if (enablePrettyPrint) {
    const levelColors: Record<LogLevel, string> = {
      trace: '\x1b[90m', // gray
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
      fatal: '\x1b[35m', // magenta
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level];
    
    let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} - ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.data && Object.keys(entry.data).length > 0) {
      output += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }
    
    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack && !isProduction) {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }
    
    return output;
  }
  
  // JSON format for production
  return JSON.stringify(entry);
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  context?: LogContext,
  error?: Error
): void {
  // Check if this log level should be output
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }
  
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  
  if (context) {
    entry.context = isProduction ? maskPII(context) as LogContext : context;
  }
  
  if (data) {
    entry.data = isProduction ? maskPII(data) : data;
  }
  
  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    };
  }
  
  const formattedLog = formatLog(entry);
  
  // Output to appropriate console method
  switch (level) {
    case 'trace':
    case 'debug':
      console.debug(formattedLog);
      break;
    case 'info':
      console.info(formattedLog);
      break;
    case 'warn':
      console.warn(formattedLog);
      break;
    case 'error':
    case 'fatal':
      console.error(formattedLog);
      break;
  }
}

/**
 * Logger interface
 */
interface Logger {
  trace: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: Error, data?: Record<string, unknown>) => void;
  fatal: (message: string, error?: Error, data?: Record<string, unknown>) => void;
  child: (context: LogContext) => Logger;
}

/**
 * Create a logger with optional context
 */
function createLogger(baseContext?: LogContext): Logger {
  return {
    trace: (message, data) => log('trace', message, data, baseContext),
    debug: (message, data) => log('debug', message, data, baseContext),
    info: (message, data) => log('info', message, data, baseContext),
    warn: (message, data) => log('warn', message, data, baseContext),
    error: (message, error, data) => log('error', message, data, baseContext, error),
    fatal: (message, error, data) => log('fatal', message, data, baseContext, error),
    child: (context) => createLogger({ ...baseContext, ...context }),
  };
}

// Export the default logger
export const logger = createLogger();

// Export child logger factory for specific modules
export function createModuleLogger(moduleName: string): Logger {
  return logger.child({ module: moduleName });
}

// Export request logger factory for API routes
export function createRequestLogger(requestId: string, path: string, method: string): Logger {
  return logger.child({ requestId, path, method });
}

// Export user logger factory for authenticated requests
export function createUserLogger(userId: string, requestId?: string): Logger {
  return logger.child({ userId, requestId });
}

// Utility to generate request IDs
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export types
export type { Logger, LogContext, LogLevel };
