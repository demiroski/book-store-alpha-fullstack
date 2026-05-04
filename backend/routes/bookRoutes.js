const express = require("express");
const mongoose = require("mongoose");
const Book = require("../models/Book");
const Review = require("../models/Review");
const Like = require("../models/Like");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

router.get("/", async (req, res) => {
  try {
    const books = await Book.find({ isHidden: false, isDeleted: false }).sort({ createdAt: 1 });
    return res.json(books);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load books" });
  }
});

router.get("/admin/all", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const books = await Book.find({ isDeleted: false }).sort({ createdAt: 1 });
    return res.json(books);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load admin books" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid book id" });
    const book = await Book.findById(id);
    if (!book || book.isDeleted) return res.status(404).json({ message: "Book not found" });
    if (book.isHidden) return res.status(404).json({ message: "Book not found" });
    return res.json(book);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load book" });
  }
});

router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    const {
      title,
      author,
      genre,
      categories,
      image,
      description,
      originalPrice,
      discount,
      rating,
    } = b;
    if (!title || !author || !image || originalPrice === undefined) {
      return res.status(400).json({ message: "title, author, image, and originalPrice are required" });
    }
    const orig = Number(originalPrice);
    const disc = Number(discount || 0);
    const rat = rating !== undefined ? Number(rating) : 5;
    if (Number.isNaN(orig) || orig < 0) return res.status(400).json({ message: "Invalid originalPrice" });
    if (Number.isNaN(disc) || disc < 0 || disc > 100) return res.status(400).json({ message: "Invalid discount" });
    const price = orig * (1 - disc / 100);
    const cats = Array.isArray(categories) ? categories : typeof genre === "string" ? genre.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const book = await Book.create({
      title: String(title).trim(),
      author: String(author).trim(),
      genre: typeof genre === "string" ? genre : cats.join(", "),
      categories: cats,
      image: String(image).trim(),
      description: String(description || ""),
      originalPrice: orig,
      discount: disc,
      price,
      rating: Number.isNaN(rat) ? 5 : Math.min(5, Math.max(0, rat)),
      isHidden: false,
      isDeleted: false,
      isCustom: true,
      createdBy: req.userId,
    });
    return res.status(201).json(book);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create book" });
  }
});

router.put("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid book id" });
    const book = await Book.findById(id);
    if (!book || book.isDeleted) return res.status(404).json({ message: "Book not found" });

    const b = req.body || {};
    const fields = [
      "title",
      "author",
      "genre",
      "categories",
      "image",
      "description",
      "originalPrice",
      "discount",
      "rating",
    ];
    fields.forEach((f) => {
      if (b[f] !== undefined) book[f] = b[f];
    });
    if (Array.isArray(b.categories)) book.categories = b.categories;
    if (b.originalPrice !== undefined || b.discount !== undefined) {
      const orig = Number(book.originalPrice);
      const disc = Number(book.discount || 0);
      book.price = orig * (1 - disc / 100);
    }
    await book.save();
    return res.json(book);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update book" });
  }
});

router.patch("/:id/hide", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid book id" });
    const book = await Book.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isHidden: true },
      { new: true }
    );
    if (!book) return res.status(404).json({ message: "Book not found" });
    return res.json(book);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to hide book" });
  }
});

router.patch("/:id/show", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid book id" });
    const book = await Book.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isHidden: false },
      { new: true }
    );
    if (!book) return res.status(404).json({ message: "Book not found" });
    return res.json(book);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to show book" });
  }
});

router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid book id" });
    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const oid = new mongoose.Types.ObjectId(id);
    await Promise.all([
      Review.deleteMany({ bookId: oid }),
      Like.deleteMany({ bookId: oid }),
      Cart.updateMany({ "items.bookId": oid }, { $pull: { items: { bookId: oid } } }),
      Order.updateMany({ "items.bookId": oid }, { $pull: { items: { bookId: oid } } }),
    ]);
    await Book.findByIdAndDelete(id);

    return res.json({ message: "Book permanently deleted from the database", id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete book" });
  }
});

module.exports = router;
