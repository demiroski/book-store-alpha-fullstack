const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const User = require("../models/User");

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.userRole !== "admin") {
      query.userId = req.userId;
    }
    const orders = await Order.find(query).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load orders" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const {
      items,
      fullName,
      phone,
      email,
      address,
      country,
      city,
      notes,
      lat,
      lng,
      mapLink,
      totalPrice,
    } = body;

    if (!fullName || !phone || !address) {
      return res.status(400).json({ message: "fullName, phone, and address are required" });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    const lineItems = Array.isArray(items) && items.length > 0 ? items : [];
    let total = Number(totalPrice);
    if (Number.isNaN(total)) {
      total = lineItems.reduce((sum, it) => {
        const q = Number(it.quantity) || 1;
        const p = Number(it.unitPrice) || 0;
        return sum + q * p;
      }, 0);
    }

    const order = await Order.create({
      userId: user._id,
      username: user.name,
      items: lineItems.map((it) => ({
        bookId: it.bookId && mongoose.Types.ObjectId.isValid(it.bookId) ? it.bookId : null,
        title: it.title || "Book",
        image: it.image || "",
        author: it.author || "",
        quantity: Math.min(99, Math.max(1, Number(it.quantity) || 1)),
        unitPrice: Number(it.unitPrice) || 0,
      })),
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      email: String(email || "").trim(),
      address: String(address).trim(),
      country: String(country || "").trim(),
      city: String(city || "").trim(),
      notes: String(notes || "").trim(),
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      mapLink: String(mapLink || "").trim(),
      totalPrice: total,
      status: "pending",
    });

    return res.status(201).json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create order" });
  }
});

router.patch("/:id/status", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }
    const { status } = req.body || {};
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update order" });
  }
});

module.exports = router;
