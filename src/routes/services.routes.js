const router = require("express").Router();
const { z } = require("zod");
const prisma = require("../prisma");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { ApiError } = require("../utils/apiError");

router.get("/photographers/:id/services", async (req, res, next) => {
  try {
    const items = await prisma.service.findMany({
      where: { photographerId: req.params.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: items });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  body: z.object({
    photographerId: z.string().uuid(),
    title: z.string().min(2),
    description: z.string().max(2000).optional(),
    durationMin: z.number().int().min(15).max(480),
    priceCents: z.number().int().min(0).max(10_000_000),
    isActive: z.boolean().optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

router.post(
  "/services",
  auth,
  requireRole("ADMIN"),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const data = req.validated.body;

      const photog = await prisma.photographerProfile.findUnique({
        where: { id: data.photographerId },
      });
      if (!photog)
        throw new ApiError(
          400,
          "INVALID_PHOTOGRAPHER",
          "photographerId does not exist",
        );

      const created = await prisma.service.create({ data });
      res.status(201).json({ data: created });
    } catch (e) {
      next(e);
    }
  },
);

const patchSchema = z.object({
  body: z.object({
    title: z.string().min(2).optional(),
    description: z.string().max(2000).optional().nullable(),
    durationMin: z.number().int().min(15).max(480).optional(),
    priceCents: z.number().int().min(0).max(10_000_000).optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).passthrough(),
});

router.patch(
  "/services/:id",
  auth,
  requireRole("ADMIN"),
  validate(patchSchema),
  async (req, res, next) => {
    try {
      const updated = await prisma.service
        .update({
          where: { id: req.params.id },
          data: req.validated.body,
        })
        .catch(() => null);

      if (!updated) throw new ApiError(404, "NOT_FOUND", "Service not found");
      res.json({ data: updated });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/services/:id",
  auth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const deleted = await prisma.service
        .delete({ where: { id: req.params.id } })
        .catch(() => null);
      if (!deleted) throw new ApiError(404, "NOT_FOUND", "Service not found");
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

module.exports = router;
