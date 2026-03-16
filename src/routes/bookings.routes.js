const router = require("express").Router();
const { z } = require("zod");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createListQuerySchema,
} = require("../utils/list");
const {
  createBooking,
  cancelBooking,
  completeBooking,
  getMyBookings,
  getAllBookings,
  getPhotographerBookings,
  searchAvailablePhotographers,
} = require("../services/booking.service");

const bookingListQuerySchema = createListQuerySchema({
  sortBy: ["startAt", "createdAt", "status"],
  defaultSortBy: "startAt",
  filters: {
    status: z.enum(["PENDING", "CANCELLED", "COMPLETED"]).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    photographerId: z.string().uuid().optional(),
    clientId: z.string().uuid().optional(),
  },
});

const createBookingSchema = z.object({
  body: z.object({
    photographerId: z.string().uuid(),
    startAt: z.string().datetime({ offset: true }),
    durationHours: z.number().int().min(1),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

router.post(
  "/bookings",
  auth,
  requireRole("CLIENT", "ADMIN"),
  validate(createBookingSchema),
  async (req, res, next) => {
    try {
      const { photographerId, startAt, durationHours } = req.validated.body;

      const booking = await createBooking({
        userId: req.user.sub,
        role: req.user.role,
        photographerId,
        startAt: new Date(startAt),
        durationHours,
      });

      res.status(201).json({ data: booking });
    } catch (e) {
      next(e);
    }
  },
);

const myBookingsSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
  query: bookingListQuerySchema.omit({
    photographerId: true,
    clientId: true,
  }),
});

router.get(
  "/bookings/my",
  auth,
  requireRole("CLIENT"),
  validate(myBookingsSchema),
  async (req, res, next) => {
    try {
      const { status, from, to, page, limit, sortBy, sortOrder } =
        req.validated.query;

      const items = await getMyBookings(req.user.sub, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters: {
          status,
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        },
      });

      res.json(items);
    } catch (e) {
      next(e);
    }
  },
);

const allBookingsSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
  query: bookingListQuerySchema,
});

router.get(
  "/bookings",
  auth,
  requireRole("ADMIN"),
  validate(allBookingsSchema),
  async (req, res, next) => {
    try {
      const { status, from, to, photographerId, clientId, page, limit, sortBy, sortOrder } =
        req.validated.query;

      const items = await getAllBookings({
        page,
        limit,
        sortBy,
        sortOrder,
        filters: {
          status,
          photographerId,
          clientId,
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        },
      });

      res.json(items);
    } catch (e) {
      next(e);
    }
  },
);

const photographerBookingsSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() }),
  query: bookingListQuerySchema.omit({
    photographerId: true,
    clientId: true,
  }),
});

router.get(
  "/photographers/:id/bookings",
  auth,
  requireRole("PHOTOGRAPHER", "ADMIN"),
  validate(photographerBookingsSchema),
  async (req, res, next) => {
    try {
      const { status, from, to, page, limit, sortBy, sortOrder } =
        req.validated.query;

      const items = await getPhotographerBookings({
        photographerId: req.validated.params.id,
        requester: {
          userId: req.user.sub,
          role: req.user.role,
        },
        query: {
          page,
          limit,
          sortBy,
          sortOrder,
          filters: {
            status,
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
          },
        },
      });

      res.json(items);
    } catch (e) {
      next(e);
    }
  },
);

const cancelBookingSchema = z.object({
  body: z.object({
    cancelReason: z.string().max(1000).optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).passthrough(),
});

router.post(
  "/bookings/:id/cancel",
  auth,
  requireRole("CLIENT", "ADMIN"),
  validate(cancelBookingSchema),
  async (req, res, next) => {
    try {
      const booking = await cancelBooking({
        bookingId: req.validated.params.id,
        cancelReason: req.validated.body.cancelReason,
        userId: req.user.sub,
        role: req.user.role,
      });

      res.json({ data: booking });
    } catch (e) {
      next(e);
    }
  },
);

const completeBookingSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).passthrough(),
});

router.post(
  "/bookings/:id/complete",
  auth,
  requireRole("ADMIN"),
  validate(completeBookingSchema),
  async (req, res, next) => {
    try {
      const booking = await completeBooking({
        bookingId: req.validated.params.id,
        userId: req.user.sub,
        role: req.user.role,
      });

      res.json({ data: booking });
    } catch (e) {
      next(e);
    }
  },
);

const availablePhotographersSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
  query: createListQuerySchema({
    sortBy: ["displayName", "city", "createdAt", "averageRating"],
    defaultSortBy: "displayName",
    filters: {
      startAt: z.string().datetime({ offset: true }),
      endAt: z.string().datetime({ offset: true }),
      city: z.string().max(120).optional(),
      serviceId: z.string().uuid().optional(),
      minRating: z.coerce.number().min(1).max(5).optional(),
    },
  }),
});

router.get(
  "/search/available",
  validate(availablePhotographersSchema),
  async (req, res, next) => {
    try {
      const {
        startAt,
        endAt,
        city,
        serviceId,
        minRating,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.validated.query;

      const result = await searchAvailablePhotographers({
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        city,
        serviceId,
        minRating,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

module.exports = router;
