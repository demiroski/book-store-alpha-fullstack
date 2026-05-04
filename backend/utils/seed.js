const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Book = require("../models/Book");

/**
 * Canonical default catalog (15 books). Used for initial seed and Reset Catalog.
 */
function getDefaultBooks() {
  return [
    {
      title: "Coco Goose",
      author: "Aimee Agresti",
      genre: "Contemporary Fiction, Romance",
      categories: ["Contemporary Fiction", "Romance"],
      image: "image/book_1.jpg",
      description:
        "A fresh, modern retelling of a classic story, Coco Goose follows a young woman navigating the complexities of love, identity, and reinvention in a world that constantly tries to define her. Witty, heartfelt, and full of charm, it is a love story for a new generation.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Subletter",
      author: "D.D. Marks",
      genre: "Drama, Mystery, Contemporary",
      categories: ["Drama", "Mystery", "Contemporary"],
      image: "image/book_2.jpg",
      description:
        "When a young professional sublets her Paris apartment, she returns to find a trail of secrets left behind by the stranger who lived there. A gripping story of identity, trust, and the lives we leave behind in the spaces we inhabit.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Westpart",
      author: "S.L. Harpell",
      genre: "Young Adult, Thriller, Survival",
      categories: ["Young Adult", "Thriller", "Survival"],
      image: "image/book_3.jpg",
      description:
        "Stranded in the wilderness after a school trip goes wrong, a teenage girl must fight to survive against the odds. Westpart is a gripping coming-of-age thriller about resilience, fear, and the strength we discover when everything is stripped away.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Beautifully Broken",
      author: "C.A. King",
      genre: "Dark Romance, Psychological Thriller",
      categories: ["Dark Romance", "Psychological Thriller"],
      image: "image/book_4.jpg",
      description:
        "What are they hiding? A haunting psychological romance that explores the twisted connection between two broken souls. Beautifully Broken pulls readers into a world of secrets, obsession, and the desperate search for redemption in the darkest of places.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Clever Lands",
      author: "Lucy Crehan",
      genre: "Non-Fiction, Education",
      categories: ["Non-Fiction", "Education"],
      image: "image/book_5.jpg",
      description:
        "Lucy Crehan travelled to the top-performing school systems in the world — Finland, Japan, Canada, Singapore, and Shanghai — to find out what the teachers and students there are actually doing differently. A must-read for educators and anyone curious about how the world learns.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Shattered",
      author: "Dick Francis",
      genre: "Crime, Thriller, Mystery",
      categories: ["Crime", "Thriller", "Mystery"],
      image: "image/book_6.jpg",
      description:
        "When a champion jockey dies in Gerard Logan's arms, he entrusts Gerard with a mysterious videotape. Now someone wants that tape back — badly. Dick Francis at his best: fast-paced, razor-sharp, and utterly unputdownable.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "The Art City",
      author: "Marco Rossi",
      genre: "Art, Culture, Urban Studies",
      categories: ["Art", "Culture", "Urban Studies"],
      image: "image/book_7.png",
      description:
        "A vivid exploration of how art shapes the soul of a city. From street murals to grand galleries, The Art City investigates how creative expression defines communities, sparks revolutions, and transforms ordinary spaces into extraordinary places.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Music Rock: Listen Always",
      author: "James Hartley",
      genre: "Music, Biography, Culture",
      categories: ["Music", "Biography", "Culture"],
      image: "image/book_8.png",
      description:
        "A passionate tribute to rock music and its undying spirit. Through personal stories, cultural history, and vivid imagery, this book captures why rock music is always a good idea — from its rebellious roots to its lasting impact on generations of listeners.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Free Fall",
      author: "Peter Cawdron",
      genre: "Science Fiction, Thriller",
      categories: ["Science Fiction", "Thriller"],
      image: "image/book_9.jpg",
      description:
        "When a spacecraft falls silent and begins a deadly plunge toward Earth, one engineer has to figure out what went wrong — and whether it was an accident. Peter Cawdron delivers a relentlessly tense sci-fi thriller grounded in real science and human drama.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Patterns of Tomorrow",
      author: "Elena Voss",
      genre: "Design, Architecture, Modern Art",
      categories: ["Design", "Architecture", "Modern Art"],
      image: "image/book_10.png",
      description:
        "A bold visual journey through the world of modern design. Patterns of Tomorrow showcases how geometric form and color interact to shape everything from urban architecture to everyday objects, challenging readers to see the world through a designer's eye.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Boring Girls",
      author: "Sara Taylor",
      genre: "Dark Fiction, Music, Thriller",
      categories: ["Dark Fiction", "Music", "Thriller"],
      image: "image/book_11.jpg",
      description:
        "Rachel and Fern bond over their love of metal music and their rage at a world that has wronged them. What begins as friendship escalates into something far darker. Metal. Mayhem. Murder. Sara Taylor's debut novel is unflinching and utterly gripping.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Give Thanks in Everything",
      author: "David Okafor",
      genre: "Self-Help, Spirituality, Motivation",
      categories: ["Self-Help", "Spirituality", "Motivation"],
      image: "image/book_12.png",
      description:
        "A heartfelt guide to cultivating gratitude in every season of life. Through powerful stories and practical exercises, David Okafor shows how choosing thankfulness — even in hardship — transforms relationships, mindsets, and futures.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Reaching Together",
      author: "Amara Diallo",
      genre: "Community, Social Justice, Inspiration",
      categories: ["Community", "Social Justice", "Inspiration"],
      image: "image/book_13.png",
      description:
        "A powerful call to collective action, Reaching Together explores how communities rise when individuals choose solidarity over silence. Part memoir, part manifesto, this book inspires readers to stretch beyond themselves and uplift those around them.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "The Lighthouse Keeper",
      author: "Nora Albright",
      genre: "Literary Fiction, Adventure, Historical",
      categories: ["Literary Fiction", "Adventure", "Historical"],
      image: "image/book_14.png",
      description:
        "On a remote coastline, an aging lighthouse keeper guards a secret that could change the lives of the fishing village below. A beautifully written novel about solitude, duty, and the stories we keep from those we love.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
    {
      title: "Black History Month: Young Readers Edition",
      author: "Patricia Monroe",
      genre: "History, Education, Children",
      categories: ["History", "Education", "Children"],
      image: "image/book_15.png",
      description:
        "A vibrant and accessible celebration of Black history for young readers. Filled with inspiring stories of pioneers, inventors, artists, and leaders, this book brings history to life and empowers the next generation to know their roots and dream boldly.",
      originalPrice: 51,
      price: 51,
      discount: 0,
      rating: 5,
      isHidden: false,
      isDeleted: false,
      isCustom: false,
      createdBy: null,
    },
  ];
}

async function ensureAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "Admin";
  if (!email || !password) return;

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
      await existing.save();
    }
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email,
    password: hash,
    role: "admin",
  });
}

async function seedBooksIfEmpty() {
  const count = await Book.countDocuments();
  if (count > 0) return;

  const defaults = getDefaultBooks().map((b) => ({
    ...b,
    price: b.originalPrice * (1 - (b.discount || 0) / 100),
  }));
  await Book.insertMany(defaults);
}

module.exports = {
  getDefaultBooks,
  ensureAdminUser,
  seedBooksIfEmpty,
};
