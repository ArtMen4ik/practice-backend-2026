const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadAppWithPrisma,
  startServer,
  request,
  signToken,
} = require("./helpers/testApp");

const PHOTOGRAPHER_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";

function createBasePrismaMock({
  conflict = false,
  createBookingResult,
  bookingCount = 0,
} = {}) {
  return {
    photographerProfile: {
      findUnique: async ({ where }) =>
        where.id === PHOTOGRAPHER_ID
          ? {
              id: PHOTOGRAPHER_ID,
              userId: "33333333-3333-4333-8333-333333333333",
              displayName: "Art Photo",
              city: "Kazan",
            }
          : null,
    },
    booking: {
      findFirst: async () => (conflict ? { id: "busy-booking" } : null),
      create: async ({ data }) =>
        createBookingResult || {
          id: "booking-1",
          ...data,
          status: "PENDING",
          cancelReason: null,
          cancelledById: null,
          createdAt: "2026-03-16T10:00:00.000Z",
          updatedAt: "2026-03-16T10:00:00.000Z",
        },
      count: async () => bookingCount,
      findMany: async () => [],
    },
    user: {
      findUnique: async () => ({
        id: CLIENT_ID,
        email: "client@example.com",
        role: "CLIENT",
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    },
  };
}

test("POST /bookings creates booking for authorized client", async () => {
  const prismaMock = createBasePrismaMock();
  const app = loadAppWithPrisma(prismaMock);
  const server = await startServer(app);
  const token = signToken({
    sub: CLIENT_ID,
    role: "CLIENT",
    email: "client@example.com",
  });

  try {
    const response = await request({
      baseUrl: server.baseUrl,
      method: "POST",
      path: "/bookings",
      token,
      body: {
        photographerId: PHOTOGRAPHER_ID,
        startAt: "2099-04-01T10:00:00.000Z",
        durationHours: 2,
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.data.photographerId, PHOTOGRAPHER_ID);
    assert.equal(response.json.data.clientId, CLIENT_ID);
    assert.equal(response.json.data.durationHours, 2);
    assert.equal(response.json.data.status, "PENDING");
  } finally {
    await server.close();
  }
});

test("POST /bookings returns 409 on time intersection", async () => {
  const prismaMock = createBasePrismaMock({ conflict: true });
  const app = loadAppWithPrisma(prismaMock);
  const server = await startServer(app);
  const token = signToken({
    sub: CLIENT_ID,
    role: "CLIENT",
    email: "client@example.com",
  });

  try {
    const response = await request({
      baseUrl: server.baseUrl,
      method: "POST",
      path: "/bookings",
      token,
      body: {
        photographerId: PHOTOGRAPHER_ID,
        startAt: "2099-04-01T10:00:00.000Z",
        durationHours: 1,
      },
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.error.code, "TIME_CONFLICT");
  } finally {
    await server.close();
  }
});

test("POST /bookings rejects startAt in the past", async () => {
  const prismaMock = createBasePrismaMock();
  const app = loadAppWithPrisma(prismaMock);
  const server = await startServer(app);
  const token = signToken({
    sub: CLIENT_ID,
    role: "CLIENT",
    email: "client@example.com",
  });

  try {
    const response = await request({
      baseUrl: server.baseUrl,
      method: "POST",
      path: "/bookings",
      token,
      body: {
        photographerId: PHOTOGRAPHER_ID,
        startAt: "2020-01-01T10:00:00.000Z",
        durationHours: 1,
      },
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.error.code, "VALIDATION_ERROR");
  } finally {
    await server.close();
  }
});
