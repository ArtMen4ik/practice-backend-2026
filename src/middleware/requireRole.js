const { ApiError } = require("../utils/apiError");

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user)
      return next(new ApiError(401, "UNAUTHORIZED", "Not authenticated"));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "FORBIDDEN", "Insufficient permissions"));
    }
    return next();
  };
}

module.exports = { requireRole };
