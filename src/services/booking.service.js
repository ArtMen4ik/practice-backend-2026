const prisma = require("../prisma");
const { ApiError } = require("../utils/apiError");

function logBusinessOperation({ userId, role, action, result, reason = null }) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      userId,
      role,
      action,
      result,
      reason,
    }),
  );
}

function assertCreateInput(startAt, durationHours) {
  if (!Number.isInteger(durationHours) || durationHours < 1) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "durationHours must be an integer >= 1",
    );
  }

  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", "startAt must be a valid ISO datetime");
  }

  if (startAt <= new Date()) {
    throw new ApiError(400, "VALIDATION_ERROR", "startAt must be in the future");
  }
}

async function createBooking({ userId, role, photographerId, startAt, durationHours }) {
  try {
    assertCreateInput(startAt, durationHours);

    const photographer = await prisma.photographerProfile.findUnique({
      where: { id: photographerId },
      select: { id: true },
    });

    if (!photographer) {
      throw new ApiError(404, "NOT_FOUND", "Photographer not found");
    }

    const endAt = new Date(startAt.getTime() + durationHours * 60 * 60 * 1000);

    const conflict = await prisma.booking.findFirst({
      where: {
        photographerId,
        status: { not: "CANCELLED" },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ApiError(
        409,
        "TIME_CONFLICT",
        "Booking time intersects with an existing booking",
      );
    }

    const created = await prisma.booking.create({
      data: {
        photographerId,
        clientId: userId,
        startAt,
        endAt,
        durationHours,
      },
    });

    logBusinessOperation({
      userId,
      role,
      action: "BOOKING_CREATE",
      result: "SUCCESS",
    });

    return created;
  } catch (error) {
    logBusinessOperation({
      userId,
      role,
      action: "BOOKING_CREATE_REJECTED",
      result: "REJECTED",
      reason: error.code || error.message,
    });

    throw error;
  }
}

async function cancelBooking({ bookingId, cancelReason, userId, role }) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) {
    logBusinessOperation({
      userId,
      role,
      action: "BOOKING_CANCEL_REJECTED",
      result: "REJECTED",
      reason: "NOT_FOUND",
    });
    throw new ApiError(404, "NOT_FOUND", "Booking not found");
  }

  if (role === "CLIENT" && booking.clientId !== userId) {
    logBusinessOperation({
      userId,
      role,
      action: "BOOKING_CANCEL_REJECTED",
      result: "REJECTED",
      reason: "FORBIDDEN",
    });
    throw new ApiError(403, "FORBIDDEN", "Cannot cancel another user's booking");
  }

  if (booking.status !== "PENDING") {
    logBusinessOperation({
      userId,
      role,
      action: "BOOKING_CANCEL_REJECTED",
      result: "REJECTED",
      reason: "INVALID_STATUS_TRANSITION",
    });
    throw new ApiError(
      400,
      "INVALID_STATUS_TRANSITION",
      "Only PENDING booking can be cancelled",
    );
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      cancelledById: userId,
      cancelReason: cancelReason ?? null,
    },
  });

  logBusinessOperation({
    userId,
    role,
    action: "BOOKING_CANCEL",
    result: "SUCCESS",
  });

  return updated;
}

async function getMyBookings(clientId) {
  return prisma.booking.findMany({
    where: { clientId },
    orderBy: { startAt: "desc" },
  });
}

async function getAllBookings() {
  return prisma.booking.findMany({
    orderBy: { startAt: "desc" },
  });
}

module.exports = {
  createBooking,
  cancelBooking,
  getMyBookings,
  getAllBookings,
};
