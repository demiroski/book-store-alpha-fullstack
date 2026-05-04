const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const { ensureAdminUser, seedBooksIfEmpty } = require("./utils/seed");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const bookRoutes = require("./routes/bookRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");
const likeRoutes = require("./routes/likeRoutes");
const adminRoutes = require("./routes/adminRoutes");

function validateEnv() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !String(uri).trim()) {
    console.error("FATAL: MONGODB_URI is missing. Copy .env.example to .env and set your Atlas connection string.");
    process.exit(1);
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).length < 16) {
    console.error("FATAL: JWT_SECRET is missing or shorter than 16 characters. Set a long random secret in .env.");
    process.exit(1);
  }
}

validateEnv();

const app = express();

const origins = ["http://localhost:3000", "http://127.0.0.1:3000"];
if (process.env.FRONTEND_URL && String(process.env.FRONTEND_URL).trim()) {
  const u = process.env.FRONTEND_URL.trim().replace(/\/$/, "");
  if (!origins.includes(u)) origins.push(u);
}

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "ALPHA Book Store API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "API route not found",
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Internal server error" });
});

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await connectDB(process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message || err);
    process.exit(1);
  }

  try {
    await ensureAdminUser();
    await seedBooksIfEmpty();
    console.log("Seed / admin check completed");
  } catch (err) {
    console.error("Seed failed:", err.message || err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`ALPHA Book Store API listening on http://localhost:${PORT}`);
  });
}

start();
