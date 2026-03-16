const router = require("express").Router();
const { z } = require("zod");
const prisma = require("../prisma");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { ApiError } = require("../utils/apiError");
const {
  createListQuerySchema,
  queryBooleanSchema,
  buildListMeta,
  getPaginationParams,
  pickDefinedFilters,
} = require("../utils/list");
const { getPhotographerSchedule } = require("../services/booking.service");
const { listPhotographerReviews } = require("../services/review.service");

const photographerListQuerySchema = createListQuerySchema({
  sortBy: ["createdAt", "displayName", "city"],
  defaultSortBy: "createdAt",
  filters: {
    city: z.string().max(120).optional(),
    search: z.string().max(120).optional(),
    isActive: queryBooleanSchema.optional(),
  },
});

const photographerListSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
  query: photographerListQuerySchema,
});

const photographerReviewsSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() }),
  query: createListQuerySchema({
    sortBy: ["createdAt", "rating"],
    defaultSortBy: "createdAt",
    filters: {
      rating: z.coerce.number().int().min(1).max(5).optional(),
    },
  }),
});

const photographerScheduleSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  }),
});

async function attachPhotographerRatings(items) {
  if (items.length === 0) return [];

  const grouped = await prisma.review.groupBy({
    by: ["photographerId"],
    where: { photographerId: { in: items.map((item) => item.id) } },
    _avg: { rating: true },
    _count: { id: true },
  });

  const ratingMap = new Map(
    grouped.map((item) => [
      item.photographerId,
      {
        averageRating: item._avg.rating ? Number(item._avg.rating.toFixed(2)) : null,
        reviewCount: item._count.id,
      },
    ]),
  );

  return items.map((item) => ({
    ...item,
    averageRating: ratingMap.get(item.id)?.averageRating ?? null,
    reviewCount: ratingMap.get(item.id)?.reviewCount ?? 0,
  }));
}

router.get("/", validate(photographerListSchema), async (req, res, next) => {
  try {
    const { city, search, isActive, page, limit, sortBy, sortOrder } =
      req.validated.query;
    const where = {
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(isActive !== undefined ? { isActive } : { isActive: true }),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: "insensitive" } },
              { bio: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const total = await prisma.photographerProfile.count({ where });
    const { skip, take } = getPaginationParams(page, limit);
    const items = await prisma.photographerProfile.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        displayName: true,
        bio: true,
        city: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      data: await attachPhotographerRatings(items),
      meta: buildListMeta({
        page,
        limit,
        total,
        sortBy,
        sortOrder,
        filters: pickDefinedFilters({ city, search, isActive }),
      }),
    });
  } catch (e) {
    next(e);
  }
});

router.get(
  "/:id/schedule",
  validate(photographerScheduleSchema),
  async (req, res, next) => {
    try {
      const schedule = await getPhotographerSchedule({
        photographerId: req.validated.params.id,
        from: new Date(req.validated.query.from),
        to: new Date(req.validated.query.to),
      });

      res.json(schedule);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id/reviews",
  validate(photographerReviewsSchema),
  async (req, res, next) => {
    try {
      const result = await listPhotographerReviews({
        photographerId: req.validated.params.id,
        ...req.validated.query,
      });

      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/:id", async (req, res, next) => {
  try {
    const item = await prisma.photographerProfile.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        displayName: true,
        bio: true,
        city: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) throw new ApiError(404, "NOT_FOUND", "Photographer not found");

    const [stats] = await attachPhotographerRatings([item]);
    res.json({ data: stats });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    displayName: z.string().min(2),
    bio: z.string().max(2000).optional(),
    city: z.string().max(120).optional(),
    timezone: z.string().max(60).optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

router.post(
  "/",
  auth,
  requireRole("ADMIN"),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const data = req.validated.body;

      const user = await prisma.user.findUnique({ where: { id: data.userId } });
      if (!user)
        throw new ApiError(400, "INVALID_USER", "userId does not exist");

      const created = await prisma.photographerProfile.create({ data });
      res.status(201).json({ data: created });
    } catch (e) {
      next(e);
    }
  },
);

const patchSchema = z.object({
  body: z.object({
    displayName: z.string().min(2).optional(),
    bio: z.string().max(2000).optional().nullable(),
    city: z.string().max(120).optional().nullable(),
    timezone: z.string().max(60).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).passthrough(),
});

router.patch(
  "/:id",
  auth,
  requireRole("ADMIN"),
  validate(patchSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params;
      const updated = await prisma.photographerProfile
        .update({
          where: { id },
          data: req.validated.body,
        })
        .catch(() => null);

      if (!updated)
        throw new ApiError(404, "NOT_FOUND", "Photographer not found");
      res.json({ data: updated });
    } catch (e) {
      next(e);
    }
  },
);

router.delete("/:id", auth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const deleted = await prisma.photographerProfile
      .delete({
        where: { id: req.params.id },
      })
      .catch(() => null);

    if (!deleted)
      throw new ApiError(404, "NOT_FOUND", "Photographer not found");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
