const { ApiError } = require("../utils/apiError");

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Internal Server Error";

  if (status >= 500) console.error(err);

  res.status(status).json({
    error: {
      code,
      message,
      details: err.details || null,
    },
  });
}

module.exports = { errorHandler };
