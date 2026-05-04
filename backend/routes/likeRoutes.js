const express = require("express");
const mongoose = require("mongoose");
const Like = require("../models/Like");
const Book = require("../models/Book");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.userRole === "admin") {
      const likes = await Like.find()
        .sort({ createdAt: -1 })
        .limit(500)
        .populate("userId", "name email");
      return res.json(likes);
    }
    const likes = await Like.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.json(likes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load likes" });
  }
});

router.post("/:bookId", authMiddleware, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    const book = await Book.findOne({ _id: bookId, isDeleted: false });
    if (!book) return res.status(404).json({ message: "Book not found" });

    try {
      const like = await Like.create({
        userId: req.userId,
        bookId: book._id,
        bookTitle: book.title,
      });
      return res.status(201).json(like);
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ message: "Already liked" });
      }
      throw e;
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to like book" });
  }
});

router.delete("/:bookId", authMiddleware, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    await Like.deleteOne({ userId: req.userId, bookId });
    return res.json({ message: "Like removed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to remove like" });
  }
});

module.exports = router;
