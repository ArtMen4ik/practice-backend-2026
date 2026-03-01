const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../prisma");
const { ApiError } = require("../utils/apiError");
const { validate } = require("../middleware/validate");
const { auth } = require("../middleware/auth");

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6).max(72),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new ApiError(409, "EMAIL_TAKEN", "Email already registered");

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, passwordHash, role: "CLIENT" },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ data: user });
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6).max(72),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );

    const token = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({ data: { token } });
  } catch (e) {
    next(e);
  }
});

router.get("/me", auth, async (req, res, next) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    res.json({ data: me });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
