const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    genre: { type: String, default: "" },
    categories: [{ type: String, trim: true }],
    image: { type: String, required: true },
    description: { type: String, default: "" },
    originalPrice: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    rating: { type: Number, default: 5, min: 0, max: 5 },
    isHidden: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isCustom: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
