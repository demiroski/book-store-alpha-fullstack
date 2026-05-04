const express = require("express");
const mongoose = require("mongoose");
const Review = require("../models/Review");
const Book = require("../models/Book");
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const User = require("../models/User");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).limit(200);
    return res.json(reviews);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

router.get("/book/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    const reviews = await Review.find({ bookId }).sort({ createdAt: -1 });
    return res.json(reviews);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { bookId, bookTitle, comment, rating } = req.body || {};
    if (!comment || rating === undefined) {
      return res.status(400).json({ message: "comment and rating are required" });
    }
    const r = parseInt(rating, 10);
    if (Number.isNaN(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: "rating must be 1–5" });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    let bTitle = bookTitle || "Store";
    let bId = null;
    if (bookId && mongoose.Types.ObjectId.isValid(bookId)) {
      const book = await Book.findById(bookId);
      if (book && !book.isDeleted) {
        bId = book._id;
        bTitle = book.title;
      }
    }

    const review = await Review.create({
      userId: user._id,
      username: user.name,
      bookId: bId,
      bookTitle: bTitle,
      comment: String(comment).trim(),
      rating: r,
    });
    return res.status(201).json(review);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to save review" });
  }
});

router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid review id" });
    }
    const deleted = await Review.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Review not found" });
    return res.json({ message: "Review deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete review" });
  }
});

module.exports = router;
