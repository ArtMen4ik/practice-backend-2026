const router = require("express").Router();
const { z } = require("zod");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createBooking,
  cancelBooking,
  getMyBookings,
  getAllBookings,
} = require("../services/booking.service");

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

router.get("/bookings/my", auth, requireRole("CLIENT"), async (req, res, next) => {
  try {
    const items = await getMyBookings(req.user.sub);
    res.json({ data: items });
  } catch (e) {
    next(e);
  }
});

router.get("/bookings", auth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const items = await getAllBookings();
    res.json({ data: items });
  } catch (e) {
    next(e);
  }
});

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

module.exports = router;
