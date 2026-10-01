
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const workRoutes = require("./routes/workRoutes");
const contactRoutes = require("./routes/contactRoutes");
const profileRoutes = require("./routes/profileRoutes");
const testimonialRoutes = require("./routes/testimonialRoutes");
const tenderRoutes = require("./routes/tenderRoutes");
const siteRoutes = require("./routes/siteRoutes");
connectDB();

const app = express();

/* =========================================================
   CORS CONFIGURATION
========================================================= */

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",

  // Production frontend
  "https://navnirman-construction.vercel.app",

  // Optional custom production domain
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    : []),
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  // Exact allowed origins
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  /*
    Allow Vercel preview deployments for this project.

    Example:
    navnirman-construction-git-main-rahul-b95f.vercel.app
    navnirman-construction-8uk32zkp0-rahul-b95f.vercel.app
  */
  if (
    origin.endsWith(".vercel.app") &&
    origin.includes("navnirman-construction")
  ) {
    return true;
  }

  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   LOGGER
========================================================= */

app.use(morgan("dev"));

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
  });
});

/* =========================================================
   API ROUTES
========================================================= */

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/works", workRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/testimonials", testimonialRoutes);
app.use("/api/tenders", tenderRoutes);
app.use("/api/sites", siteRoutes);
/* =========================================================
   ERROR HANDLING
========================================================= */

app.use(notFound);
app.use(errorHandler);

/* =========================================================
   SERVER
========================================================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
