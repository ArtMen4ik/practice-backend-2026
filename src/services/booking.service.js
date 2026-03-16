const prisma = require("../prisma");
const { ApiError } = require("../utils/apiError");
const {
  buildListMeta,
  getPaginationParams,
  pickDefinedFilters,
} = require("../utils/list");

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

function assertDateRange(from, to) {
  if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", "from must be a valid ISO datetime");
  }

  if (!(to instanceof Date) || Number.isNaN(to.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", "to must be a valid ISO datetime");
  }

  if (from >= to) {
    throw new ApiError(400, "VALIDATION_ERROR", "from must be earlier than to");
  }
}

async function ensurePhotographerExists(photographerId) {
  const photographer = await prisma.photographerProfile.findUnique({
    where: { id: photographerId },
    select: { id: true, userId: true, displayName: true, city: true },
  });

  if (!photographer) {
    throw new ApiError(404, "NOT_FOUND", "Photographer not found");
  }

  return photographer;
}

function buildBookingWhere(filters = {}) {
  const where = {};

  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.photographerId) where.photographerId = filters.photographerId;
  if (filters.status) where.status = filters.status;

  if (filters.from || filters.to) {
    where.startAt = {};
    if (filters.from) where.startAt.gte = filters.from;
    if (filters.to) where.startAt.lte = filters.to;
  }

  return where;
}

function bookingListSelect() {
  return {
    id: true,
    photographerId: true,
    clientId: true,
    startAt: true,
    endAt: true,
    durationHours: true,
    status: true,
    cancelReason: true,
    cancelledById: true,
    createdAt: true,
    updatedAt: true,
    photographer: {
      select: {
        id: true,
        displayName: true,
        city: true,
        timezone: true,
      },
    },
    client: {
      select: {
        id: true,
        email: true,
      },
    },
    review: {
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    },
  };
}

async function createBooking({ userId, role, photographerId, startAt, durationHours }) {
  try {
    assertCreateInput(startAt, durationHours);
    await ensurePhotographerExists(photographerId);

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

async function completeBooking({ bookingId, userId, role }) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) {
    throw new ApiError(404, "NOT_FOUND", "Booking not found");
  }

  if (booking.status !== "PENDING") {
    throw new ApiError(
      400,
      "INVALID_STATUS_TRANSITION",
      "Only PENDING booking can be completed",
    );
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "COMPLETED" },
  });

  logBusinessOperation({
    userId,
    role,
    action: "BOOKING_COMPLETE",
    result: "SUCCESS",
  });

  return updated;
}

async function listBookings({
  filters = {},
  page,
  limit,
  sortBy,
  sortOrder,
}) {
  const where = buildBookingWhere(filters);
  const orderBy = { [sortBy]: sortOrder };
  const total = await prisma.booking.count({ where });
  const { skip, take } = getPaginationParams(page, limit);

  const items = await prisma.booking.findMany({
    where,
    orderBy,
    skip,
    take,
    select: bookingListSelect(),
  });

  return {
    data: items,
    meta: buildListMeta({
      page,
      limit,
      total,
      sortBy,
      sortOrder,
      filters: pickDefinedFilters({
        clientId: filters.clientId,
        photographerId: filters.photographerId,
        status: filters.status,
        from: filters.from?.toISOString(),
        to: filters.to?.toISOString(),
      }),
    }),
  };
}

async function getMyBookings(clientId, query) {
  return listBookings({
    ...query,
    filters: {
      ...query.filters,
      clientId,
    },
  });
}

async function getAllBookings(query) {
  return listBookings(query);
}

async function getPhotographerBookings({ photographerId, requester, query }) {
  const photographer = await ensurePhotographerExists(photographerId);

  if (
    requester.role === "PHOTOGRAPHER" &&
    photographer.userId !== requester.userId
  ) {
    throw new ApiError(403, "FORBIDDEN", "Cannot view another photographer's bookings");
  }

  return listBookings({
    ...query,
    filters: {
      ...query.filters,
      photographerId,
    },
  });
}

function buildFreeSlots(bookings, from, to) {
  const freeSlots = [];
  let cursor = new Date(from);

  for (const booking of bookings) {
    const busyStart = booking.startAt < from ? from : booking.startAt;
    const busyEnd = booking.endAt > to ? to : booking.endAt;

    if (busyStart > cursor) {
      freeSlots.push({
        startAt: new Date(cursor),
        endAt: new Date(busyStart),
      });
    }

    if (busyEnd > cursor) {
      cursor = new Date(busyEnd);
    }
  }

  if (cursor < to) {
    freeSlots.push({
      startAt: new Date(cursor),
      endAt: new Date(to),
    });
  }

  return freeSlots;
}

async function getPhotographerSchedule({ photographerId, from, to }) {
  assertDateRange(from, to);
  const photographer = await ensurePhotographerExists(photographerId);

  const bookings = await prisma.booking.findMany({
    where: {
      photographerId,
      status: { not: "CANCELLED" },
      startAt: { lt: to },
      endAt: { gt: from },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      durationHours: true,
    },
  });

  return {
    data: {
      photographer: {
        id: photographer.id,
        displayName: photographer.displayName,
        city: photographer.city,
      },
      from,
      to,
      busySlots: bookings,
      freeSlots: buildFreeSlots(bookings, from, to),
    },
  };
}

async function searchAvailablePhotographers({
  startAt,
  endAt,
  city,
  serviceId,
  minRating,
  page,
  limit,
  sortBy,
  sortOrder,
}) {
  assertDateRange(startAt, endAt);

  if (serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });

    if (!service) {
      throw new ApiError(404, "NOT_FOUND", "Service not found");
    }
  }

  const photographers = await prisma.photographerProfile.findMany({
    where: {
      isActive: true,
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(serviceId
        ? {
            services: {
              some: {
                id: serviceId,
                isActive: true,
              },
            },
          }
        : {}),
      bookings: {
        none: {
          status: { not: "CANCELLED" },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      bio: true,
      city: true,
      timezone: true,
      createdAt: true,
      services: {
        where: serviceId ? { id: serviceId, isActive: true } : { isActive: true },
        select: {
          id: true,
          title: true,
          durationMin: true,
          priceCents: true,
        },
        orderBy: { priceCents: "asc" },
      },
    },
  });

  const ratings = photographers.length
    ? await prisma.review.groupBy({
        by: ["photographerId"],
        where: {
          photographerId: { in: photographers.map((item) => item.id) },
        },
        _avg: { rating: true },
        _count: { id: true },
      })
    : [];

  const ratingMap = new Map(
    ratings.map((item) => [
      item.photographerId,
      {
        averageRating: item._avg.rating ? Number(item._avg.rating.toFixed(2)) : null,
        reviewCount: item._count.id,
      },
    ]),
  );

  let items = photographers.map((item) => {
    const ratingInfo = ratingMap.get(item.id) ?? {
      averageRating: null,
      reviewCount: 0,
    };

    return {
      ...item,
      averageRating: ratingInfo.averageRating,
      reviewCount: ratingInfo.reviewCount,
    };
  });

  if (minRating !== undefined) {
    items = items.filter(
      (item) => item.averageRating !== null && item.averageRating >= minRating,
    );
  }

  items.sort((left, right) => {
    const direction = sortOrder === "asc" ? 1 : -1;
    const leftValue =
      sortBy === "averageRating"
        ? left.averageRating ?? -1
        : left[sortBy] ?? "";
    const rightValue =
      sortBy === "averageRating"
        ? right.averageRating ?? -1
        : right[sortBy] ?? "";

    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });

  const total = items.length;
  const { skip, take } = getPaginationParams(page, limit);

  return {
    data: items.slice(skip, skip + take),
    meta: buildListMeta({
      page,
      limit,
      total,
      sortBy,
      sortOrder,
      filters: pickDefinedFilters({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        city,
        serviceId,
        minRating,
      }),
    }),
  };
}

module.exports = {
  createBooking,
  cancelBooking,
  completeBooking,
  getMyBookings,
  getAllBookings,
  getPhotographerBookings,
  getPhotographerSchedule,
  searchAvailablePhotographers,
};
