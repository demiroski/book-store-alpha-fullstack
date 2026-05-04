/**
 * Integration checks for admin flows (same API as the admin UI).
 * Usage: from backend/, with API already on PORT (default 5000):
 *   node test-admin-flows.js
 */
require("dotenv").config();
const BASE = `http://localhost:${Number(process.env.PORT) || 5000}/api`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

async function jfetch(path, opts = {}) {
  const url = BASE + path;
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error((body && body.message) || res.statusText || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  assert(adminEmail && adminPassword, "ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");

  console.log("1. Login as admin…");
  const login = await jfetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  assert(login.token && login.user && login.user.role === "admin", "Admin login should return token and admin role");
  const adminAuth = { Authorization: `Bearer ${login.token}` };

  console.log("2. Open /admin (API: auth/me + admin routes)…");
  const me = await jfetch("/auth/me", { headers: adminAuth });
  assert(me.user && me.user.role === "admin", "/auth/me should return admin user");

  console.log("3. Reset Catalog…");
  const resetMsg = await jfetch("/admin/reset-catalog", {
    method: "POST",
    headers: adminAuth,
    body: "{}",
  });
  assert(resetMsg && resetMsg.message, "Reset should return JSON message");

  console.log("4. Book Management: admin books…");
  let adminBooks = await jfetch("/admin/books", { headers: adminAuth });
  assert(Array.isArray(adminBooks) && adminBooks.length === 15, `Expected 15 books after reset, got ${adminBooks.length}`);

  console.log("5. Add new book…");
  const newBookPayload = {
    title: "E2E Test Book " + Date.now(),
    author: "Test Author",
    originalPrice: 19.99,
    discount: 10,
    rating: 4.2,
    image: "https://covers.openlibrary.org/b/id/8739161-L.jpg",
    description: "Created by test-admin-flows.js",
    categories: ["Fiction"],
    genre: "Fiction",
  };
  const created = await jfetch("/books", {
    method: "POST",
    headers: adminAuth,
    body: JSON.stringify(newBookPayload),
  });
  assert(created._id && created.title === newBookPayload.title, "POST /books should return created book");
  const newId = String(created._id);

  adminBooks = await jfetch("/admin/books", { headers: adminAuth });
  const foundNew = adminBooks.some((b) => String(b._id) === newId);
  assert(foundNew, "New book should appear in GET /admin/books");

  let storefront = await jfetch("/books");
  assert(storefront.some((b) => String(b._id) === newId), "New book should appear on public GET /books");

  console.log("6. Hide book → hidden from homepage…");
  await jfetch(`/books/${newId}/hide`, { method: "PATCH", headers: adminAuth });
  storefront = await jfetch("/books");
  assert(!storefront.some((b) => String(b._id) === newId), "Hidden book must not appear on GET /books");

  console.log("7. Unhide book → visible again…");
  await jfetch(`/books/${newId}/show`, { method: "PATCH", headers: adminAuth });
  storefront = await jfetch("/books");
  assert(storefront.some((b) => String(b._id) === newId), "Unhidden book should appear on GET /books again");

  console.log("8. Delete book…");
  await jfetch(`/books/${newId}`, { method: "DELETE", headers: adminAuth });
  adminBooks = await jfetch("/admin/books", { headers: adminAuth });
  assert(!adminBooks.some((b) => String(b._id) === newId), "Deleted book must not appear in admin list");
  storefront = await jfetch("/books");
  assert(!storefront.some((b) => String(b._id) === newId), "Deleted book must not appear on homepage");

  console.log("9. Register normal user → listed under users…");
  const uEmail = `e2e_user_${Date.now()}@test.local`;
  const reg = await jfetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "E2E Normal User",
      email: uEmail,
      password: "testpass1234",
    }),
  });
  assert(reg.token && reg.user && reg.user.role === "user", "Register should succeed");
  const users = await jfetch("/users", { headers: adminAuth });
  assert(Array.isArray(users) && users.some((u) => u.email === uEmail), "New user should appear in GET /users");

  console.log("10. Like a book → appears in likes (admin view)…");
  const userToken = reg.token;
  const userAuth = { Authorization: `Bearer ${userToken}` };
  const meUser = await jfetch("/auth/me", { headers: userAuth });
  const normalUserId = String(meUser.user.id);
  const firstBookId = String(adminBooks[0]._id);
  await jfetch(`/likes/${firstBookId}`, { method: "POST", headers: userAuth });
  const likes = await jfetch("/likes", { headers: adminAuth });
  const likeMatch = likes.find((l) => String(l.bookId) === firstBookId);
  assert(likeMatch, "Admin likes list should include a like for the chosen book");
  const likedBy = likeMatch.userId && (likeMatch.userId._id || likeMatch.userId);
  assert(String(likedBy) === normalUserId, "Like should be attributed to the new normal user");

  // Optional cleanup: unlike (not required for test pass)
  try {
    await jfetch(`/likes/${firstBookId}`, { method: "DELETE", headers: userAuth });
  } catch (_) {}

  console.log("\nAll 10 checks passed.");
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
});
