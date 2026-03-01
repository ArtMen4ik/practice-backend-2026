const router = require("express").Router();
const { z } = require("zod");
const prisma = require("../prisma");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { ApiError } = require("../utils/apiError");

router.get("/", async (req, res, next) => {
  try {
    const items = await prisma.photographerProfile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        displayName: true,
        bio: true,
        city: true,
        timezone: true,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: items });
  } catch (e) {
    next(e);
  }
});

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
      },
    });
    if (!item) throw new ApiError(404, "NOT_FOUND", "Photographer not found");
    res.json({ data: item });
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

      // убедимся, что user существует и роль PHOTOGRAPHER (по желанию)
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
