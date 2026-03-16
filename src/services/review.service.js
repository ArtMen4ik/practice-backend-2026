const prisma = require("../prisma");
const { ApiError } = require("../utils/apiError");
const {
  buildListMeta,
  getPaginationParams,
  pickDefinedFilters,
} = require("../utils/list");

async function createReview({ bookingId, rating, comment, userId }) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      review: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, "NOT_FOUND", "Booking not found");
  }

  if (booking.clientId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "Cannot review another user's booking");
  }

  if (booking.status !== "COMPLETED") {
    throw new ApiError(
      400,
      "INVALID_BOOKING_STATUS",
      "Review can be created only for COMPLETED booking",
    );
  }

  if (booking.review) {
    throw new ApiError(409, "REVIEW_EXISTS", "Review already exists for this booking");
  }

  return prisma.review.create({
    data: {
      bookingId,
      clientId: userId,
      photographerId: booking.photographerId,
      rating,
      comment: comment ?? null,
    },
    select: {
      id: true,
      bookingId: true,
      photographerId: true,
      clientId: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function deleteReview(reviewId) {
  const review = await prisma.review
    .delete({
      where: { id: reviewId },
    })
    .catch(() => null);

  if (!review) {
    throw new ApiError(404, "NOT_FOUND", "Review not found");
  }
}

async function listPhotographerReviews({
  photographerId,
  page,
  limit,
  sortBy,
  sortOrder,
  rating,
}) {
  const photographer = await prisma.photographerProfile.findUnique({
    where: { id: photographerId },
    select: { id: true },
  });

  if (!photographer) {
    throw new ApiError(404, "NOT_FOUND", "Photographer not found");
  }

  const where = {
    photographerId,
    ...(rating !== undefined ? { rating } : {}),
  };

  const total = await prisma.review.count({ where });
  const { skip, take } = getPaginationParams(page, limit);

  const items = await prisma.review.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take,
    select: {
      id: true,
      bookingId: true,
      photographerId: true,
      clientId: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      client: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  const stats = await prisma.review.aggregate({
    where: { photographerId },
    _avg: { rating: true },
    _count: { id: true },
  });

  return {
    data: items,
    meta: {
      ...buildListMeta({
        page,
        limit,
        total,
        sortBy,
        sortOrder,
        filters: pickDefinedFilters({ rating }),
      }),
      averageRating: stats._avg.rating
        ? Number(stats._avg.rating.toFixed(2))
        : null,
      reviewCount: stats._count.id,
    },
  };
}

module.exports = {
  createReview,
  deleteReview,
  listPhotographerReviews,
};
