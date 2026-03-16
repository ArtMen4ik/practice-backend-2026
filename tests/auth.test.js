const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadAppWithPrisma,
  startServer,
  request,
  signToken,
} = require("./helpers/testApp");

test("GET /auth/me without token returns 401", async () => {
  const prismaMock = {
    user: {
      findUnique: async () => null,
    },
  };

  const app = loadAppWithPrisma(prismaMock);
  const server = await startServer(app);

  try {
    const response = await request({
      baseUrl: server.baseUrl,
      method: "GET",
      path: "/auth/me",
    });

    assert.equal(response.status, 401);
    assert.equal(response.json.error.code, "UNAUTHORIZED");
  } finally {
    await server.close();
  }
});

test("GET /auth/me with valid token returns current user", async () => {
  const prismaMock = {
    user: {
      findUnique: async ({ where }) => ({
        id: where.id,
        email: "client@example.com",
        role: "CLIENT",
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    },
  };

  const app = loadAppWithPrisma(prismaMock);
  const server = await startServer(app);
  const token = signToken({
    sub: "user-1",
    role: "CLIENT",
    email: "client@example.com",
  });

  try {
    const response = await request({
      baseUrl: server.baseUrl,
      method: "GET",
      path: "/auth/me",
      token,
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.data.id, "user-1");
    assert.equal(response.json.data.role, "CLIENT");
  } finally {
    await server.close();
  }
});

test("GET /bookings without token returns 401", async () => {
  const prismaMock = {
    booking: {
      count: async () => 0,
      findMany: async () => [],
    },
  };

  const app = loadAppWithPrisma(prismaMock);
  const server = await startServer(app);

  try {
    const response = await request({
      baseUrl: server.baseUrl,
      method: "GET",
      path: "/bookings",
    });

    assert.equal(response.status, 401);
    assert.equal(response.json.error.code, "UNAUTHORIZED");
  } finally {
    await server.close();
  }
});
