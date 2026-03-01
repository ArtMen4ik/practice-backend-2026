require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const photographersRoutes = require("./routes/photographers.routes");
const servicesRoutes = require("./routes/services.routes");

const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => res.json({ message: "Booking API is running" }));

app.use("/auth", authRoutes);
app.use("/photographers", photographersRoutes);
app.use("/", servicesRoutes);

app.use(errorHandler);

module.exports = app;
