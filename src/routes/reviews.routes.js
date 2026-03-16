const router = require("express").Router();
const { z } = require("zod");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { createReview, deleteReview } = require("../services/review.service");

const createReviewSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

router.post(
  "/reviews",
  auth,
  requireRole("CLIENT"),
  validate(createReviewSchema),
  async (req, res, next) => {
    try {
      const review = await createReview({
        ...req.validated.body,
        userId: req.user.sub,
      });

      res.status(201).json({ data: review });
    } catch (e) {
      next(e);
    }
  },
);

const deleteReviewSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).passthrough(),
});

router.delete(
  "/reviews/:id",
  auth,
  requireRole("ADMIN"),
  validate(deleteReviewSchema),
  async (req, res, next) => {
    try {
      await deleteReview(req.validated.params.id);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

module.exports = router;
