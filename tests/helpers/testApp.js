const jwt = require("jsonwebtoken");

function clearSrcModules() {
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes("/src/")) {
      delete require.cache[modulePath];
    }
  }
}

function loadAppWithPrisma(prismaMock) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/booking_db";

  clearSrcModules();

  const prismaPath = require.resolve("../../src/prisma");
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };

  return require("../../src/app");
}

async function startServer(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    server,
    baseUrl,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

async function request({
  baseUrl,
  method,
  path,
  body,
  token,
}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  };
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
}

module.exports = {
  loadAppWithPrisma,
  startServer,
  request,
  signToken,
};
