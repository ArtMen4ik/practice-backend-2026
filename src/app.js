require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const photographersRoutes = require("./routes/photographers.routes");
const servicesRoutes = require("./routes/services.routes");
const bookingsRoutes = require("./routes/bookings.routes");
const reviewsRoutes = require("./routes/reviews.routes");
const docsRoutes = require("./routes/docs.routes");

const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => res.json({ message: "Booking API is running" }));

app.use("/auth", authRoutes);
app.use("/", docsRoutes);
app.use("/photographers", photographersRoutes);
app.use("/", servicesRoutes);
app.use("/", bookingsRoutes);
app.use("/", reviewsRoutes);

app.use(errorHandler);

module.exports = app;
