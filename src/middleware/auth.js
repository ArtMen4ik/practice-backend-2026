const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/apiError");

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(401, "UNAUTHORIZED", "Missing Bearer token"));
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, role, email }
    return next();
  } catch {
    return next(new ApiError(401, "UNAUTHORIZED", "Invalid or expired token"));
  }
}

module.exports = { auth };
