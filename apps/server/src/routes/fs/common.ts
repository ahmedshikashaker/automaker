/**
 * Common utilities for fs routes
 */

import { createLogger } from '@automaker/utils';
import { getErrorMessage as getErrorMessageShared, createLogError, isENOENT } from '../common.js';

const logger = createLogger('FS');

// Re-export shared utilities
export { getErrorMessageShared as getErrorMessage };
export { isENOENT };
export const logError = createLogError(logger);
