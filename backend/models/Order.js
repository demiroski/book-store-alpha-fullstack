const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", default: null },
    title: { type: String, required: true },
    image: { type: String, default: "" },
    author: { type: String, default: "" },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },
    items: { type: [orderItemSchema], default: [] },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    address: { type: String, required: true },
    country: { type: String, default: "" },
    city: { type: String, default: "" },
    notes: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    mapLink: { type: String, default: "" },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

module.exports = mongoose.model("Order", orderSchema);
