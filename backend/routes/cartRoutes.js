const express = require("express");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.userId);
    return res.json(cart);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load cart" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { bookId, title, image, author, unitPrice, quantity } = req.body || {};
    if (!title) return res.status(400).json({ message: "title is required" });

    const cart = await getOrCreateCart(req.userId);
    const bid = bookId && mongoose.Types.ObjectId.isValid(bookId) ? bookId : null;
    const price = Number(unitPrice) || 0;
    const qty = Math.min(99, Math.max(1, Number(quantity) || 1));

    const matchIdx = cart.items.findIndex((it) =>
      bid ? String(it.bookId) === String(bid) : it.title === title && !it.bookId
    );

    if (matchIdx >= 0) {
      cart.items[matchIdx].quantity = Math.min(99, cart.items[matchIdx].quantity + qty);
    } else {
      cart.items.push({
        bookId: bid,
        title: String(title).trim(),
        image: String(image || ""),
        author: String(author || ""),
        unitPrice: price,
        quantity: qty,
      });
    }
    await cart.save();
    return res.json(cart);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update cart" });
  }
});

router.delete("/:bookId", authMiddleware, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    const cart = await getOrCreateCart(req.userId);
    cart.items = cart.items.filter((it) => String(it.bookId) !== bookId);
    await cart.save();
    return res.json(cart);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to remove cart item" });
  }
});

router.delete("/", authMiddleware, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.userId);
    cart.items = [];
    await cart.save();
    return res.json(cart);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to clear cart" });
  }
});

module.exports = router;
