/**
 * Wrapper for async express routes to catch errors
 * @param {Function} fn - Async function
 * @returns {Function} - Express route handler
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
