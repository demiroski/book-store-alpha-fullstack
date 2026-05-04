const express = require("express");
const Book = require("../models/Book");
const User = require("../models/User");
const Order = require("../models/Order");
const Review = require("../models/Review");
const Cart = require("../models/Cart");
const Like = require("../models/Like");
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const { getDefaultBooks } = require("../utils/seed");

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get("/books", async (req, res) => {
  try {
    const books = await Book.find({ isDeleted: false }).sort({ createdAt: 1 });
    return res.json(books);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load admin books" });
  }
});

router.get("/dashboard-stats", async (req, res) => {
  try {
    const [
      totalUsers,
      totalBooks,
      totalVisibleBooks,
      totalHiddenBooks,
      totalOrders,
      totalReviews,
      totalLikes,
    ] = await Promise.all([
      User.countDocuments(),
      Book.countDocuments({ isDeleted: false }),
      Book.countDocuments({ isDeleted: false, isHidden: false }),
      Book.countDocuments({ isDeleted: false, isHidden: true }),
      Order.countDocuments(),
      Review.countDocuments(),
      Like.countDocuments(),
    ]);

    return res.json({
      totalUsers,
      totalBooks,
      totalVisibleBooks,
      totalHiddenBooks,
      totalOrders,
      totalReviews,
      totalLikes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load stats" });
  }
});

router.post("/reset-catalog", async (req, res) => {
  try {
    await Promise.all([
      Book.deleteMany({}),
      Review.deleteMany({}),
      Order.deleteMany({}),
      Cart.deleteMany({}),
      Like.deleteMany({}),
    ]);

    const defaults = getDefaultBooks().map((b) => ({
      ...b,
      price: b.originalPrice * (1 - (b.discount || 0) / 100),
    }));
    await Book.insertMany(defaults);

    return res.json({
      message: "Catalog reset to original 15 books. Reviews, orders, carts, and likes were cleared. Users were kept.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to reset catalog" });
  }
});

module.exports = router;
