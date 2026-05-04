/* ALPHA Book Store - API client & storefront */
const API_BASE_URL = "http://localhost:5000/api";
const LS_TOKEN = "alpha_token";
const LS_USER = "alpha_user";

window.API_BASE_URL = API_BASE_URL;

function getToken() {
  return localStorage.getItem(LS_TOKEN);
}
function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem(LS_USER) || "null");
  } catch (e) {
    return null;
  }
}
function setAuth(token, user) {
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USER, JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
}
function isLoggedIn() {
  return !!getToken();
}

async function apiFetch(path, options) {
  const url = API_BASE_URL + (path.startsWith("/") ? path : "/" + path);
  const opts = Object.assign({ mode: "cors", credentials: "omit" }, options || {});
  const headers = Object.assign({}, opts.headers || {});
  const t = getToken();
  if (t) headers.Authorization = "Bearer " + t;
  if (opts.body && typeof opts.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  opts.headers = headers;
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        if (j.message) msg = j.message;
      } catch (_) {}
      const err = new Error(msg);
      err.status = res.status;
      err.url = url;
      throw err;
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  } catch (e) {
    if (e.name === "TypeError" && String(e.message).includes("fetch")) {
      console.error("apiFetch failed (network):", url, e);
      throw new Error(
        "Backend is not running. Start the API on http://localhost:5000"
      );
    }
    console.error("apiFetch failed:", url, e);
    throw e;
  }
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Mongo like doc may expose bookId as string or { _id } */
function likeDocBookId(l) {
  var id = l && l.bookId;
  if (id && typeof id === "object" && id._id) return String(id._id);
  return String(id || "");
}

/**
 * Single source of truth after GET /likes: updates all .s-like-btn (search + modal),
 * and re-renders My Liked Books if that panel is open.
 */
function refreshLikedUIFromServer() {
  if (!isLoggedIn()) {
    document.querySelectorAll(".s-like-btn").forEach(function (btn) {
      btn.textContent = "\u2764 Like";
      btn.style.background = "#e74c3c";
      btn.style.cursor = "pointer";
      btn.style.opacity = "";
      btn.title = "";
    });
    return Promise.resolve();
  }
  return apiFetch("/likes", { method: "GET" })
    .then(function (likes) {
      likes = likes || [];
      var ids = new Set(likes.map(likeDocBookId));
      document.querySelectorAll(".s-like-btn").forEach(function (btn) {
        var bid = btn.dataset.bookid;
        if (!bid) {
          if (btn.id === "modalLikeBtn") return;
          btn.style.opacity = "0.45";
          btn.title = "Likes are only for catalog books";
          return;
        }
        btn.style.opacity = "";
        btn.title = "";
        if (ids.has(bid)) {
          btn.textContent = "\u2764 Liked";
          btn.style.background = "#c0392b";
          btn.style.cursor = "default";
        } else {
          btn.textContent = "\u2764 Like";
          btn.style.background = "#e74c3c";
          btn.style.cursor = "pointer";
        }
      });
      var lp = document.getElementById("likedBooksPanel");
      if (lp && lp.classList.contains("active") && typeof window.__alphaRenderLikedBooks === "function") {
        window.__alphaRenderLikedBooks();
      }
    })
    .catch(function () {});
}

/** Like a catalog book (POST /likes/:id); then refresh all like UI. */
function handleStorefrontLikeButtonClick(likeBtn, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (!likeBtn) return Promise.resolve();
  var bookTitle = likeBtn.dataset.title;
  var bookId = likeBtn.dataset.bookid;
  if (!bookId) return Promise.resolve();
  if (!isLoggedIn()) {
    var sp = document.getElementById("searchPanel");
    if (sp) sp.classList.remove("active");
    var loginOvl = document.getElementById("loginOverlay");
    if (loginOvl) loginOvl.classList.add("show");
    sessionStorage.setItem("pendingLikeTitle", bookTitle || "");
    sessionStorage.setItem("pendingLikeBookId", bookId);
    return Promise.resolve();
  }
  return apiFetch("/likes/" + bookId, { method: "POST" })
    .then(function () {
      return refreshLikedUIFromServer();
    })
    .catch(function (err) {
      if (err && err.status === 409) {
        return refreshLikedUIFromServer();
      }
      alert(err && err.message ? err.message : "Like failed");
      return Promise.reject(err);
    });
}

/** Unlike (DELETE /likes/:id); then refresh all like UI. */
function tryUnlikeCatalogBook(bookId) {
  if (!bookId) return Promise.resolve();
  return apiFetch("/likes/" + bookId, { method: "DELETE" }).then(function () {
    return refreshLikedUIFromServer();
  });
}

function syncModalLikeButton(book) {
  var mLike = document.getElementById("modalLikeBtn");
  if (!mLike) return;
  if (book && book._id) {
    mLike.style.display = "";
    mLike.dataset.bookid = String(book._id);
    mLike.dataset.title = book.title || "";
    mLike.dataset.image = book.image || "";
  } else {
    mLike.style.display = "none";
    delete mLike.dataset.bookid;
    delete mLike.dataset.title;
    delete mLike.dataset.image;
  }
}

function mapBookFromApi(b) {
  const cats = Array.isArray(b.categories)
    ? b.categories
    : String(b.genre || "")
        .split(",")
        .map(function (x) {
          return x.trim();
        })
        .filter(Boolean);
  const orig = Number(b.originalPrice) || 0;
  const disc = Number(b.discount) || 0;
  const price = Number(b.price) != null ? Number(b.price) : orig * (1 - disc / 100);
  return {
    _id: b._id,
    image: b.image,
    title: b.title,
    author: b.author,
    genre: b.genre || cats.join(", "),
    categories: cats,
    price: price,
    originalPrice: orig,
    discount: disc,
    rating: Number(b.rating) || 5,
    description: b.description || "",
    isCustom: !!b.isCustom,
  };
}

var storefrontBooksCache = [];

async function refreshStorefrontBooks() {
  try {
    const raw = await apiFetch("/books", { method: "GET" });
    storefrontBooksCache = (raw || []).map(mapBookFromApi);
    return true;
  } catch (e) {
    storefrontBooksCache = [];
    console.warn(e.message || e);
    return false;
  }
}

function renderFeaturedBooks() {
  const box = document.getElementById("featuredBookBox");
  if (!box) return;
  box.innerHTML = "";

  if (!storefrontBooksCache.length) {
    box.innerHTML =
      '<p style="padding:24px;text-align:center;color:#c0392b;font-weight:bold;">' +
      esc(
        "Backend is not running or no books loaded. Start the API on http://localhost:5000"
      ) +
      "</p>";
    return;
  }

  function buildStars(rating) {
    var r = parseFloat(rating) || 5;
    var full = Math.floor(r);
    var half = r % 1 >= 0.5;
    var html = "";
    for (var i = 1; i <= 5; i++) {
      if (i <= full) html += '<i class="fa-solid fa-star"></i>';
      else if (i === full + 1 && half)
        html += '<i class="fa-solid fa-star-half-stroke"></i>';
      else html += '<i class="fa-regular fa-star"></i>';
    }
    return html;
  }

  storefrontBooksCache.forEach(function (book, index) {
    var card = document.createElement("div");
    card.className = "featured_book_card";

    var priceHTML = "";
    var discountBadge = "";
    if (book.discount > 0) {
      priceHTML =
        '<span class="new-price">$' +
        parseFloat(book.price).toFixed(2) +
        '</span><span class="old-price"><del>$' +
        parseFloat(book.originalPrice).toFixed(2) +
        "</del></span>";
      discountBadge =
        '<div class="discount-badge">' + book.discount + "% OFF</div>";
    } else {
      priceHTML =
        '<span class="new-price">$' +
        parseFloat(book.originalPrice).toFixed(2) +
        "</span>";
    }

    var genreText =
      book.categories.length > 0
        ? book.categories.join(" \u2022 ")
        : book.genre || "";

    card.innerHTML =
      '<div class="featurde_book_img">' +
      discountBadge +
      '<img src="' +
      esc(book.image) +
      '" alt="' +
      esc(book.title) +
      '"></div>' +
      '<div class="featurde_book_tag">' +
      "<h2>" +
      esc(book.title) +
      "</h2>" +
      '<p class="writer">' +
      esc(book.author) +
      "</p>" +
      '<div class="card-rating-stars">' +
      buildStars(book.rating) +
      "</div>" +
      '<div class="categories">' +
      esc(genreText) +
      "</div>" +
      '<p class="book_price">' +
      priceHTML +
      "</p>" +
      '<div class="custom-book-actions">' +
      '<button class="f_btn-details view-book-btn" data-index="' +
      index +
      '">&#128270; Details</button>' +
      '<button class="f_btn-cart add-to-cart-btn" data-index="' +
      index +
      '">&#x1F6D2; Cart</button>' +
      "</div>" +
      "</div>";

    card._bookData = book;
    box.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  if (!document.getElementById("featuredBookBox")) return;
  await refreshStorefrontBooks();
  renderFeaturedBooks();
});

document.addEventListener("DOMContentLoaded", function () {
  const overlay = document.getElementById("bookModalOverlay");
  const closeBtn = document.getElementById("bookModalClose");
  const modalSelBtn = document.getElementById("modalSelectBtn");

  function starsHTML(rating) {
    var html = "";
    var r = typeof rating === "number" ? rating : parseFloat(rating) || 0;
    var full = Math.floor(r);
    var half = r % 1 >= 0.5;
    for (var i = 1; i <= 5; i++) {
      if (i <= full) html += '<i class="fa-solid fa-star"></i>';
      else if (i === full + 1 && half)
        html += '<i class="fa-solid fa-star-half-stroke"></i>';
      else html += '<i class="fa-regular fa-star"></i>';
    }
    return html;
  }

  function openBookModal(book) {
    if (!book || !overlay) return;
    document.getElementById("modalBookImg").src = book.image;
    document.getElementById("modalBookTitle").textContent = book.title;
    document.getElementById("modalBookAuthor").textContent = book.author;
    document.getElementById("modalBookGenre").textContent = book.genre || "";
    if (book.discount > 0) {
      document.getElementById("modalBookPrice").innerHTML =
        '<span style="color:#e74c3c; font-weight:bold; font-size:24px;">$' +
        parseFloat(book.price).toFixed(2) +
        '</span> <span style="text-decoration:line-through; color:#999; font-size:16px; margin-left:10px;">$' +
        parseFloat(book.originalPrice).toFixed(2) +
        '</span> <span style="background:#e74c3c; color:#fff; padding:2px 8px; border-radius:4px; font-size:14px; font-weight:bold; margin-left:10px;">' +
        book.discount +
        "% OFF</span>";
    } else {
      document.getElementById("modalBookPrice").innerHTML =
        '<span style="color:#333; font-weight:bold; font-size:24px;">$' +
        parseFloat(book.originalPrice).toFixed(2) +
        "</span>";
    }
    document.getElementById("modalBookDesc").textContent = book.description || "";
    var ratingEl = document.getElementById("modalRatingStars");
    if (ratingEl) {
      var rr = typeof book.rating === "number" ? book.rating : 0;
      ratingEl.innerHTML =
        starsHTML(rr) +
        '<span style="margin-left:8px;font-size:14px;color:#555;">' +
        rr.toFixed(1) +
        " / 5</span>";
    }
    var catsEl = document.getElementById("modalCategoriesRow");
    if (catsEl) {
      var cats =
        Array.isArray(book.categories) && book.categories.length > 0
          ? book.categories
          : book.genre
            ? book.genre.split(",").map(function (s) {
                return s.trim();
              })
            : [];
      catsEl.innerHTML = cats
        .map(function (c) {
          return '<span class="modal-category-badge">' + esc(c) + "</span>";
        })
        .join("");
    }
    modalSelBtn._bookData = book;
    syncModalLikeButton(book);
    refreshLikeButtonStates();
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeBookModal() {
    if (overlay) overlay.classList.remove("show");
    document.body.style.overflow = "";
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".view-book-btn");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var card = btn.closest(".featured_book_card");
      if (card && card._bookData) openBookModal(card._bookData);
    }
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".add-to-cart-btn");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var card = btn.closest(".featured_book_card");
      if (card && card._bookData) addToCartFromBook(card._bookData);
    }
  });

  if (closeBtn) closeBtn.addEventListener("click", closeBookModal);
  if (overlay)
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeBookModal();
    });

  var modalLikeBtn = document.getElementById("modalLikeBtn");
  if (modalLikeBtn) {
    modalLikeBtn.addEventListener("click", function (e) {
      handleStorefrontLikeButtonClick(modalLikeBtn, e);
    });
  }

  if (modalSelBtn) {
    modalSelBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!isLoggedIn()) {
        var lo = document.getElementById("loginOverlay");
        if (lo) lo.classList.add("show");
        return;
      }
      var book = modalSelBtn._bookData;
      if (book) {
        addToCartFromBook(book);
        closeBookModal();
      }
    });
  }
});

var openLogin = document.getElementById("openLogin");
var loginOverlay = document.getElementById("loginOverlay");
var closeLoginText = document.getElementById("closeLoginText");
var loginForm = document.getElementById("loginForm");
var loginError = document.getElementById("loginError");
var welcomeMessage = document.getElementById("welcomeMessage");
var logoutBtn = document.getElementById("logoutBtn");
var adminPageLink = document.getElementById("adminPageLink");

if (openLogin)
  openLogin.addEventListener("click", function () {
    loginOverlay.classList.add("show");
  });
if (closeLoginText)
  closeLoginText.addEventListener("click", function (e) {
    e.preventDefault();
    loginOverlay.classList.remove("show");
    loginError.textContent = "";
  });
if (loginOverlay)
  loginOverlay.addEventListener("click", function (e) {
    if (e.target === loginOverlay) {
      loginOverlay.classList.remove("show");
      loginError.textContent = "";
    }
  });

function updateUIForLogin() {
  var loggedIn = isLoggedIn();
  var u = getAuthUser();
  var savedUser = u ? u.name : "";
  var role = u ? u.role : "";

  if (loggedIn) {
    if (welcomeMessage) {
      welcomeMessage.textContent = "Welcome, " + savedUser + "!";
      welcomeMessage.classList.add("active");
    }
    if (openLogin) openLogin.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    if (adminPageLink)
      adminPageLink.style.display = role === "admin" ? "inline-block" : "none";
  } else {
    if (welcomeMessage) {
      welcomeMessage.textContent = "";
      welcomeMessage.classList.remove("active");
    }
    if (openLogin) openLogin.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (adminPageLink) adminPageLink.style.display = "none";
  }
  refreshLikeButtonStates();
}

function refreshLikeButtonStates() {
  refreshLikedUIFromServer();
}

updateUIForLogin();

if (logoutBtn) {
  logoutBtn.addEventListener("click", function () {
    clearAuth();
    if (isAdminDashboardPage()) {
      window.location.href = "index.html";
      return;
    }
    window.location.reload();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    loginError.textContent = "";
    var emailEl = document.getElementById("loginEmail");
    var passEl = document.getElementById("password");
    var email = emailEl ? emailEl.value.trim() : "";
    var password = passEl ? passEl.value.trim() : "";
    try {
      var data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password }),
      });
      setAuth(data.token, data.user);
      if (data.user.role === "admin") {
        window.location.href = "admin.html";
        return;
      }
      loginOverlay.classList.remove("show");
      updateUIForLogin();

      var pendingTitle = sessionStorage.getItem("pendingLikeTitle");
      var pendingBookId = sessionStorage.getItem("pendingLikeBookId");
      if (pendingTitle && pendingBookId) {
        try {
          await apiFetch("/likes/" + pendingBookId, { method: "POST" });
          refreshLikeButtonStates();
        } catch (_) {}
        sessionStorage.removeItem("pendingLikeTitle");
        sessionStorage.removeItem("pendingLikeBookId");
        var searchPanel = document.getElementById("searchPanel");
        if (searchPanel) {
          searchPanel.classList.add("active");
          var si = document.getElementById("searchInput");
          if (si) si.dispatchEvent(new Event("input"));
        }
      }

      var poTitle = sessionStorage.getItem("pendingOrderTitle");
      if (poTitle) {
        var poImage = sessionStorage.getItem("pendingOrderImage");
        var poAuthor = sessionStorage.getItem("pendingOrderAuthor");
        var poBookId = sessionStorage.getItem("pendingOrderBookId") || "";
        var poUnit = parseFloat(sessionStorage.getItem("pendingOrderUnitPrice") || "0", 10);
        var poQty = parseInt(sessionStorage.getItem("pendingOrderQty") || "1", 10);
        sessionStorage.removeItem("pendingOrderTitle");
        sessionStorage.removeItem("pendingOrderImage");
        sessionStorage.removeItem("pendingOrderAuthor");
        sessionStorage.removeItem("pendingOrderBookId");
        sessionStorage.removeItem("pendingOrderUnitPrice");
        sessionStorage.removeItem("pendingOrderQty");
        setTimeout(function () {
          if (typeof openOrderModal === "function")
            openOrderModal(poTitle, poImage, poAuthor, poBookId, poUnit, poQty);
        }, 600);
      }
    } catch (err) {
      loginError.textContent = err.message || "Login failed";
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var signupForm = document.getElementById("signupForm");
  var signupError = document.getElementById("signupError");
  var signupSuccess = document.getElementById("signupSuccess");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var name = document.getElementById("signupName").value.trim();
    var email = document.getElementById("signupEmail").value.trim();
    var newPass = document.getElementById("signupPassword").value.trim();
    var confirm = document.getElementById("signupConfirm").value.trim();
    signupError.textContent = "";
    signupSuccess.textContent = "";

    if (!name || !email || !newPass) {
      signupError.textContent = "Please fill in all fields.";
      return;
    }
    if (newPass.length < 4) {
      signupError.textContent = "Password must be at least 4 characters.";
      return;
    }
    if (newPass !== confirm) {
      signupError.textContent = "Passwords do not match.";
      return;
    }

    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: name, email: email, password: newPass }),
      });
      signupSuccess.textContent =
        "\u2714 Account created! You can now log in with your email.";
      signupForm.reset();
      setTimeout(function () {
        switchTab("login");
      }, 1500);
    } catch (err) {
      signupError.textContent = err.message || "Sign up failed";
    }
  });
});
/* part 2a: tabs, reviews, search, arrivals */
window.switchTab = function (tab) {
  var loginForm = document.getElementById("loginForm");
  var signupForm = document.getElementById("signupForm");
  var tabLogin = document.getElementById("tabLoginBtn");
  var tabSignup = document.getElementById("tabSignupBtn");
  if (!loginForm || !signupForm) return;
  if (tab === "login") {
    loginForm.style.display = "block";
    signupForm.style.display = "none";
    tabLogin.style.color = "#089da1";
    tabLogin.style.borderBottom = "3px solid #089da1";
    tabSignup.style.color = "#888";
    tabSignup.style.borderBottom = "none";
  } else {
    loginForm.style.display = "none";
    signupForm.style.display = "block";
    tabSignup.style.color = "#089da1";
    tabSignup.style.borderBottom = "3px solid #089da1";
    tabLogin.style.color = "#888";
    tabLogin.style.borderBottom = "none";
  }
};

document.addEventListener("DOMContentLoaded", function () {
  var openReviewBtn = document.getElementById("openReviewBtn");
  var reviewBoxes = document.querySelectorAll(".review_box");
  var reviewBox = reviewBoxes[0];
  if (!openReviewBtn || !reviewBox) return;

  var reviewOverlay = document.createElement("div");
  reviewOverlay.className = "review-overlay";
  reviewOverlay.id = "reviewOverlay";
  reviewOverlay.innerHTML =
    '<div class="review-wrapper">' +
    '<form id="reviewForm">' +
    "<h2>Add Your Review</h2>" +
    '<div class="review_input_box"><label style="display:block;text-align:left;font-size:12px;color:#666;margin-bottom:4px;">Book (optional)</label>' +
    '<select id="reviewBookId" style="width:100%;padding:8px;border-radius:5px;border:1px solid #ccc;"><option value="">General \u2014 whole store</option></select></div>' +
    '<div class="review_input_box"><textarea id="reviewText" placeholder="Write your review here..." required></textarea></div>' +
    '<div class="review_input_box"><select id="reviewRating" required>' +
    '<option value="">Choose rating</option>' +
    '<option value="1">1 / 5</option><option value="2">2 / 5</option><option value="3">3 / 5</option>' +
    '<option value="4">4 / 5</option><option value="5">5 / 5</option></select></div>' +
    '<div class="review_buttons"><a href="#" id="closeReviewBtn">Close</a>' +
    '<button type="submit" class="review_submit_btn">Submit Review</button></div></form></div>';
  document.body.appendChild(reviewOverlay);

  function fillReviewBookSelect() {
    var sel = document.getElementById("reviewBookId");
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    storefrontBooksCache.forEach(function (b) {
      var o = document.createElement("option");
      o.value = b._id;
      o.textContent = b.title;
      sel.appendChild(o);
    });
  }

  function addReviewToDOM(name, text, rating) {
    var starsHTML = "";
    for (var i = 1; i <= 5; i++) {
      starsHTML +=
        i <= rating
          ? '<i class="fa-solid fa-star"></i>'
          : '<i class="fa-regular fa-star"></i>';
    }
    var newReview = document.createElement("div");
    newReview.className = "review_card dynamic-api-review";
    newReview.innerHTML =
      '<i class="fa-solid fa-quote-right"></i><div class="card_top"><img src="image/review_1.jpg" alt="review user"></div>' +
      '<div class="card"><h2>' +
      esc(name) +
      "</h2><p>" +
      esc(text) +
      '</p><div class="review_icon">' +
      starsHTML +
      "</div></div>";
    reviewBox.appendChild(newReview);
  }

  async function renderReviews() {
    document.querySelectorAll(".dynamic-api-review").forEach(function (n) {
      n.remove();
    });
    try {
      var savedReviews = await apiFetch("/reviews", { method: "GET" });
      (savedReviews || []).forEach(function (r) {
        addReviewToDOM(r.username, r.comment, r.rating);
      });
    } catch (e) {
      console.warn("reviews load", e);
    }
  }

  renderReviews();

  document.getElementById("closeReviewBtn").addEventListener("click", function (e) {
    e.preventDefault();
    reviewOverlay.classList.remove("show");
  });
  reviewOverlay.addEventListener("click", function (e) {
    if (e.target === reviewOverlay) reviewOverlay.classList.remove("show");
  });
  openReviewBtn.addEventListener("click", function () {
    fillReviewBookSelect();
    reviewOverlay.classList.add("show");
  });

  document.getElementById("reviewForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!isLoggedIn()) {
      reviewOverlay.classList.remove("show");
      var lo = document.getElementById("loginOverlay");
      if (lo) lo.classList.add("show");
      return;
    }
    var text = document.getElementById("reviewText").value.trim();
    var rating = parseInt(document.getElementById("reviewRating").value, 10);
    var bookId = document.getElementById("reviewBookId").value;
    if (!text || !rating) return;
    try {
      var payload = { comment: text, rating: rating };
      if (bookId) payload.bookId = bookId;
      else payload.bookTitle = "Store";
      await apiFetch("/reviews", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await renderReviews();
      document.getElementById("reviewForm").reset();
      reviewOverlay.classList.remove("show");
    } catch (err) {
      alert(err.message || "Could not save review");
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".expand-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var prevEl = this.previousElementSibling;
      if (prevEl) {
        var moreText = prevEl.querySelector(".more-text");
        if (moreText) {
          moreText.classList.toggle("show");
          this.textContent = moreText.classList.contains("show")
            ? "Show Less"
            : "Learn More";
        }
      }
    });
  });
});

var newArrivalsData = [
  { image: "image/arrival_1.jpg", title: "The Giver", author: "Lois Lowry", genre: "Dystopian Fiction, YA", page: "arrivales_1.html" },
  { image: "image/arrival_2.jpg", title: "The Wright Brothers", author: "David McCullough", genre: "Non-Fiction, Biography", page: "arrivales_2.html" },
  { image: "image/arrival_3.jpg", title: "Radical Gardening", author: "George McKay", genre: "Politics, Culture, Nature", page: "arrivales_3.html" },
  { image: "image/arrival_4.jpg", title: "Red Queen", author: "Victoria Aveyard", genre: "Fantasy, Young Adult", page: "arrivales_4.html" },
  { image: "image/arrival_5.jpg", title: "To Kill a Mockingbird", author: "Harper Lee", genre: "Literary Fiction, Historical", page: "arrivales_5.html" },
  { image: "image/arrival_6.jpg", title: "Harry Potter and the Philosopher's Stone", author: "J.K. Rowling", genre: "Fantasy, Adventure", page: "arrivales_6.html" },
  { image: "image/arrival_7.jpg", title: "Heroes of Olympus: The Lost Hero", author: "Rick Riordan", genre: "Fantasy, Mythology", page: "arrivales_7.html" },
  { image: "image/arrival_8.webp", title: "Diary of a Wimpy Kid: Squid Game", author: "Jeff Kinney", genre: "Comedy, Parody", page: "arrivales_8.html" },
  { image: "image/arrival_9.jpg", title: "Ranger's Apprentice: The Ruins of Gorlan", author: "John Flanagan", genre: "Fantasy, Adventure", page: "arrivales_9.html" },
  { image: "image/arrival_10.jpg", title: "Percy Jackson and the Lightning Thief", author: "Rick Riordan", genre: "Fantasy, Mythology", page: "arrivales_10.html" },
];

function buildSearchPool() {
  var pool = [];
  storefrontBooksCache.forEach(function (b) {
    pool.push({
      image: b.image,
      title: b.title,
      author: b.author,
      genre: b.genre,
      page: null,
      bookId: b._id,
      unitPrice: b.price,
    });
  });
  newArrivalsData.forEach(function (b) {
    pool.push({
      image: b.image,
      title: b.title,
      author: b.author,
      genre: b.genre,
      page: b.page,
      bookId: null,
      unitPrice: null,
    });
  });
  return pool;
}
/* part 2b: search & likes panel */
(function initSearch() {
  var toggleBtn = document.getElementById("searchToggleBtn");
  var searchPanel = document.getElementById("searchPanel");
  var closeBtn = document.getElementById("searchCloseBtn");
  var input = document.getElementById("searchInput");
  var submitBtn = document.getElementById("searchSubmitBtn");
  var resultsBox = document.getElementById("searchResults");
  if (!toggleBtn || !searchPanel) {
    window.__alphaRenderLikedBooks = function () {};
    return;
  }

  var likedToggleBtn = document.getElementById("likedBooksToggleBtn");
  var likedPanel = document.getElementById("likedBooksPanel");
  var likedCloseBtn = document.getElementById("likedBooksCloseBtn");
  var likedResults = document.getElementById("likedBooksResults");

  function findFeaturedBookByTitle(title) {
    for (var i = 0; i < storefrontBooksCache.length; i++) {
      if (storefrontBooksCache[i].title === title) return storefrontBooksCache[i];
    }
    return null;
  }

  function renderLikedBooks() {
    likedResults.innerHTML = "";
    if (!isLoggedIn()) {
      likedResults.innerHTML =
        '<p class="search-no-result" style="text-align:center;">\ud83d\udd12 Please log in to see your liked books.<br><br>' +
        '<button onclick="document.getElementById(\'loginOverlay\').classList.add(\'show\'); document.getElementById(\'likedBooksPanel\').classList.remove(\'active\');" ' +
        'style="padding:10px 28px; background:#089da1; color:#fff; border:none; border-radius:20px; font-size:15px; font-weight:bold; cursor:pointer;">Login Now</button></p>';
      return;
    }
    apiFetch("/likes", { method: "GET" })
      .then(function (likes) {
        if (!likes.length) {
          likedResults.innerHTML =
            '<p class="search-no-result">No liked books yet.</p>';
          return;
        }
        likes.forEach(function (like) {
          var bookIdStr = likeDocBookId(like);
          var card = document.createElement("div");
          card.className = "search-book-card liked-book-card";
          var img = "image/book_1.jpg";
          var fb = findFeaturedBookByTitle(like.bookTitle);
          if (fb) img = fb.image;
          card.innerHTML =
            (bookIdStr
              ? '<button type="button" class="liked-unlike-btn" data-bookid="' +
                esc(bookIdStr) +
                '" title="Unlike" aria-label="Unlike this book">&times;</button>'
              : "") +
            '<img src="' +
            esc(img) +
            '" alt="' +
            esc(like.bookTitle) +
            '" />' +
            '<div class="s-title">' +
            esc(like.bookTitle) +
            "</div>";
          var unlikeBtn = card.querySelector(".liked-unlike-btn");
          if (unlikeBtn) {
            unlikeBtn.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();
              var bid = unlikeBtn.getAttribute("data-bookid");
              if (!bid) return;
              unlikeBtn.disabled = true;
              tryUnlikeCatalogBook(bid)
                .catch(function (err) {
                  alert(err.message || "Could not unlike book");
                })
                .finally(function () {
                  if (unlikeBtn.parentNode) unlikeBtn.disabled = false;
                });
            });
          }
          card.querySelector("img").addEventListener("click", function () {
            if (fb) {
              likedPanel.classList.remove("active");
              openBookModalGlobal(fb);
            }
          });
          likedResults.appendChild(card);
        });
      })
      .catch(function () {
        likedResults.innerHTML =
          '<p class="search-no-result">Could not load likes from server.</p>';
      });
  }

  window.openBookModalGlobal = function (book) {
    var overlay = document.getElementById("bookModalOverlay");
    if (!overlay || !book) return;
    document.getElementById("modalBookImg").src = book.image;
    document.getElementById("modalBookTitle").textContent = book.title;
    document.getElementById("modalBookAuthor").textContent = book.author;
    document.getElementById("modalBookGenre").textContent = book.genre || "";
    if (book.discount > 0) {
      document.getElementById("modalBookPrice").innerHTML =
        '<span style="color:#e74c3c;font-weight:bold;font-size:24px;">$' +
        parseFloat(book.price).toFixed(2) +
        '</span> <span style="text-decoration:line-through;color:#999;">$' +
        parseFloat(book.originalPrice).toFixed(2) +
        "</span>";
    } else {
      document.getElementById("modalBookPrice").innerHTML =
        '<span style="color:#333;font-weight:bold;font-size:24px;">$' +
        parseFloat(book.originalPrice).toFixed(2) +
        "</span>";
    }
    document.getElementById("modalBookDesc").textContent = book.description || "";
    var modalSelBtn = document.getElementById("modalSelectBtn");
    if (modalSelBtn) modalSelBtn._bookData = book;
    syncModalLikeButton(book);
    refreshLikeButtonStates();
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  };

  if (likedToggleBtn && likedPanel) {
    likedToggleBtn.addEventListener("click", function () {
      searchPanel.classList.remove("active");
      likedPanel.classList.toggle("active");
      if (likedPanel.classList.contains("active")) renderLikedBooks();
    });
    likedCloseBtn.addEventListener("click", function () {
      likedPanel.classList.remove("active");
    });
  }

  toggleBtn.addEventListener("click", function () {
    if (likedPanel) likedPanel.classList.remove("active");
    searchPanel.classList.toggle("active");
    if (searchPanel.classList.contains("active")) {
      input.focus();
      showBooks(buildSearchPool(), "\ud83d\udcda All Available Books");
    }
  });

  input.addEventListener("input", function () {
    var query = input.value.trim().toLowerCase();
    var pool = buildSearchPool();
    if (!query) showBooks(pool, "\ud83d\udcda All Available Books");
    else {
      var matches = pool.filter(function (b) {
        return (
          b.title.toLowerCase().includes(query) ||
          b.author.toLowerCase().includes(query) ||
          b.genre.toLowerCase().includes(query)
        );
      });
      showBooks(matches, null, input.value);
    }
  });

  closeBtn.addEventListener("click", function () {
    searchPanel.classList.remove("active");
    input.value = "";
    resultsBox.innerHTML = "";
  });
  submitBtn.addEventListener("click", runSearch);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") runSearch();
  });

  function runSearch() {
    var query = input.value.trim().toLowerCase();
    var pool = buildSearchPool();
    if (!query) {
      showBooks(pool, "\ud83d\udcda All Available Books");
      return;
    }
    var matches = pool.filter(function (b) {
      return (
        b.title.toLowerCase().includes(query) ||
        b.author.toLowerCase().includes(query) ||
        b.genre.toLowerCase().includes(query)
      );
    });
    showBooks(
      matches,
      matches.length > 0 ? '\ud83d\udd0d Results for "' + esc(input.value) + '"' : null,
      input.value
    );
  }

  function showBooks(books, heading, searchQuery) {
    resultsBox.innerHTML = "";
    if (heading) {
      var h = document.createElement("p");
      h.className = "search-section-label";
      h.textContent = heading;
      resultsBox.appendChild(h);
    }
    if (!books.length) {
      var msg = document.createElement("p");
      msg.className = "search-no-result";
      msg.innerHTML =
        '\ud83d\ude15 No books found for "<strong>' +
        esc(searchQuery) +
        '</strong>". Try a different title.';
      resultsBox.appendChild(msg);
      return;
    }
    books.forEach(function (book) {
      var card = document.createElement("div");
      card.className = "search-book-card";
      var bid = book.bookId ? esc(book.bookId) : "";
      card.innerHTML =
        '<img src="' +
        esc(book.image) +
        '" alt="' +
        esc(book.title) +
        '" />' +
        '<div class="s-title">' +
        esc(book.title) +
        "</div>" +
        '<div class="s-author">' +
        esc(book.author) +
        "</div>" +
        '<div class="s-genre">' +
        esc(book.genre) +
        "</div>" +
        '<div style="display: flex; gap: 5px; width: 100%; margin-top: 4px;">' +
        '<button type="button" class="s-select-btn" data-title="' +
        esc(book.title) +
        '" data-image="' +
        esc(book.image) +
        '" data-author="' +
        esc(book.author || "") +
        '" data-bookid="' +
        bid +
        '" data-unitprice="' +
        (book.unitPrice != null ? book.unitPrice : "") +
        '" style="flex: 1;">\u2714 Select</button>' +
        (bid
          ? '<button type="button" class="s-like-btn" data-title="' +
            esc(book.title) +
            '" data-image="' +
            esc(book.image) +
            '" data-bookid="' +
            bid +
            '" style="flex: 1; padding: 7px 0; background: #e74c3c; color: #fff; border: none; border-radius: 20px; font-size: 13px; font-weight: bold; cursor: pointer;">\u2764 Like</button>'
          : '<span style="flex:1;font-size:11px;color:#999;text-align:center;">Like: catalog only</span>') +
        "</div>";

      card.querySelector("img").addEventListener("click", function () {
        if (book.page) window.location.href = book.page;
        else if (book.bookId) {
          var fb = findFeaturedBookByTitle(book.title);
          if (fb) {
            searchPanel.classList.remove("active");
            window.openBookModalGlobal(fb);
          }
        }
      });

      card.querySelector(".s-select-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        var t = e.currentTarget.dataset.title;
        var img = e.currentTarget.dataset.image;
        var auth = e.currentTarget.dataset.author;
        var id = e.currentTarget.dataset.bookid;
        var up = e.currentTarget.dataset.unitprice;
        if (id)
          addToCartFromBook({
            _id: id,
            title: t,
            image: img,
            author: auth,
            price: parseFloat(up) || 0,
          });
        else addToCartArrival(t, img, auth);
      });

      var likeBtn = card.querySelector(".s-like-btn");
      if (likeBtn) {
        likeBtn.addEventListener("click", function (e) {
          if (!isLoggedIn()) searchPanel.classList.remove("active");
          handleStorefrontLikeButtonClick(likeBtn, e);
        });
      }
      resultsBox.appendChild(card);
    });
    refreshLikeButtonStates();
  }

  window.__alphaRenderLikedBooks = renderLikedBooks;
})();
/* part 2c: cart, orders, video, jquery */
function showWelcomeMsg(text, duration) {
  var wm = document.getElementById("welcomeMessage");
  if (!wm) return;
  var prev = wm.textContent;
  wm.textContent = text;
  wm.classList.add("active");
  setTimeout(function () {
    wm.textContent = prev || "";
  }, duration || 2500);
}

async function addToCartFromBook(book) {
  if (!isLoggedIn()) {
    var lo = document.getElementById("loginOverlay");
    if (lo) lo.classList.add("show");
    return;
  }
  try {
    var unit =
      book.discount > 0 ? book.price : book.originalPrice != null ? book.originalPrice : book.price;
    if (!Number.isFinite(Number(unit))) unit = Number(book.price) || 0;
    await apiFetch("/cart", {
      method: "POST",
      body: JSON.stringify({
        bookId: book._id,
        title: book.title,
        image: book.image,
        author: book.author,
        unitPrice: unit,
        quantity: 1,
      }),
    });
    showWelcomeMsg("\ud83d\uded2 \"" + book.title + '" added to your cart!', 2500);
    updateCartBadge();
    var cp = document.getElementById("cartPanel");
    if (cp && cp.classList.contains("active")) renderCart();
  } catch (e) {
    alert(e.message || "Could not add to cart");
  }
}

async function addToCartArrival(title, image, author) {
  if (!isLoggedIn()) {
    var lo = document.getElementById("loginOverlay");
    if (lo) lo.classList.add("show");
    return;
  }
  try {
    await apiFetch("/cart", {
      method: "POST",
      body: JSON.stringify({
        title: title,
        image: image,
        author: author || "",
        unitPrice: 0,
        quantity: 1,
      }),
    });
    showWelcomeMsg("\ud83d\uded2 \"" + title + '" added to your cart!', 2500);
    updateCartBadge();
    var cp = document.getElementById("cartPanel");
    if (cp && cp.classList.contains("active")) renderCart();
  } catch (e) {
    alert(e.message || "Could not add to cart");
  }
}

async function getCartItems() {
  if (!isLoggedIn()) return [];
  try {
    var c = await apiFetch("/cart", { method: "GET" });
    return c.items || [];
  } catch (e) {
    return [];
  }
}

async function updateCartBadge() {
  var badge = document.getElementById("cartBadge");
  if (!badge) return;
  var items = await getCartItems();
  var count = items.reduce(function (s, it) {
    return s + (it.quantity || 1);
  }, 0);
  badge.textContent = count;
  if (count > 0) badge.classList.add("visible");
  else badge.classList.remove("visible");
}

async function removeFromCartByBookId(bookId) {
  try {
    await apiFetch("/cart/" + bookId, { method: "DELETE" });
    updateCartBadge();
    renderCart();
  } catch (e) {
    alert(e.message || "Remove failed");
  }
}

async function renderCart() {
  var box = document.getElementById("cartResults");
  if (!box) return;
  box.innerHTML = "";
  if (!isLoggedIn()) {
    box.innerHTML =
      '<p class="search-no-result" style="text-align:center;">\ud83d\udd12 Please log in to see your cart.<br><br>' +
      '<button onclick="document.getElementById(\'loginOverlay\').classList.add(\'show\'); document.getElementById(\'cartPanel\').classList.remove(\'active\');" ' +
      'style="padding:10px 28px;background:#089da1;color:#fff;border:none;border-radius:20px;font-size:15px;font-weight:bold;cursor:pointer;">Login Now</button></p>';
    return;
  }
  var cart = await getCartItems();
  if (!cart.length) {
    box.innerHTML =
      '<p class="search-no-result">Your cart is empty.<br>Browse books and add them here.</p>';
    return;
  }
  var heading = document.createElement("p");
  heading.className = "search-section-label";
  heading.textContent = "\ud83d\uded2 " + cart.length + " line(s) in your cart";
  box.appendChild(heading);

  cart.forEach(function (item) {
    var card = document.createElement("div");
    card.className = "search-book-card";
    var bid = item.bookId || "";
    card.innerHTML =
      '<img src="' +
      esc(item.image) +
      '" alt="' +
      esc(item.title) +
      '" style="cursor:default;" />' +
      '<div class="s-title">' +
      esc(item.title) +
      "</div>" +
      '<div class="s-author">' +
      esc(item.author || "") +
      "</div>" +
      '<div style="display:flex;gap:6px;width:100%;margin-top:6px;">' +
      '<button type="button" class="s-select-btn cart-order-btn" data-title="' +
      esc(item.title) +
      '" data-image="' +
      esc(item.image) +
      '" data-author="' +
      esc(item.author || "") +
      '" data-bookid="' +
      esc(bid) +
      '" data-unitprice="' +
      (item.unitPrice || 0) +
      '" data-qty="' +
      (item.quantity || 1) +
      '" style="flex:1;font-size:12px;">\ud83d\udce6 Confirm Order</button>' +
      (bid
        ? '<button type="button" class="cart-remove-btn" data-bookid="' +
          esc(bid) +
          '" style="flex:0 0 auto;padding:7px 10px;background:#e74c3c;color:#fff;border:none;border-radius:20px;font-size:12px;font-weight:bold;cursor:pointer;">\u2715 Remove</button>'
        : '<button type="button" class="cart-remove-arrival-btn" data-title="' +
          esc(item.title) +
          '" style="flex:0 0 auto;padding:7px 10px;background:#e74c3c;color:#fff;border:none;border-radius:20px;font-size:12px;font-weight:bold;cursor:pointer;">\u2715 Remove</button>') +
      "</div>";

    card.querySelector(".cart-order-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      var btn = e.currentTarget;
      document.getElementById("cartPanel").classList.remove("active");
      openOrderModal(
        btn.dataset.title,
        btn.dataset.image,
        btn.dataset.author,
        btn.dataset.bookid || "",
        parseFloat(btn.dataset.unitprice) || 0,
        parseInt(btn.dataset.qty, 10) || 1
      );
    });
    var rb = card.querySelector(".cart-remove-btn");
    if (rb)
      rb.addEventListener("click", function (e) {
        e.stopPropagation();
        removeFromCartByBookId(e.currentTarget.dataset.bookid);
      });
    var ra = card.querySelector(".cart-remove-arrival-btn");
    if (ra)
      ra.addEventListener("click", async function (e) {
        e.stopPropagation();
        var t = e.currentTarget.dataset.title;
        var fresh = await getCartItems();
        var next = fresh.filter(function (x) {
          return x.title !== t;
        });
        await apiFetch("/cart", { method: "DELETE" });
        for (var i = 0; i < next.length; i++) {
          await apiFetch("/cart", {
            method: "POST",
            body: JSON.stringify({
              bookId: next[i].bookId || undefined,
              title: next[i].title,
              image: next[i].image,
              author: next[i].author,
              unitPrice: next[i].unitPrice,
              quantity: next[i].quantity,
            }),
          });
        }
        updateCartBadge();
        renderCart();
      });
    box.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var cartBtn = document.getElementById("cartToggleBtn");
  var cartPanel = document.getElementById("cartPanel");
  var cartClose = document.getElementById("cartCloseBtn");
  if (cartBtn && cartPanel) {
    cartBtn.addEventListener("click", function () {
      document.getElementById("searchPanel")?.classList.remove("active");
      document.getElementById("likedBooksPanel")?.classList.remove("active");
      cartPanel.classList.toggle("active");
      if (cartPanel.classList.contains("active")) renderCart();
    });
    cartClose.addEventListener("click", function () {
      cartPanel.classList.remove("active");
    });
  }
  updateCartBadge();
});

var orderMap = null;
var orderMarker = null;

function openOrderModal(bookTitle, bookImage, bookAuthor, bookId, unitPrice, qty) {
  bookId = bookId || "";
  unitPrice = unitPrice != null ? unitPrice : 0;
  qty = qty || 1;
  if (!isLoggedIn()) {
    var lo = document.getElementById("loginOverlay");
    if (lo) lo.classList.add("show");
    sessionStorage.setItem("pendingOrderTitle", bookTitle);
    sessionStorage.setItem("pendingOrderImage", bookImage);
    sessionStorage.setItem("pendingOrderAuthor", bookAuthor || "");
    sessionStorage.setItem("pendingOrderBookId", bookId);
    sessionStorage.setItem("pendingOrderUnitPrice", String(unitPrice));
    sessionStorage.setItem("pendingOrderQty", String(qty));
    return;
  }
  var idEl = document.getElementById("orderBookId");
  if (idEl) idEl.value = bookId;
  document.getElementById("orderBookTitle").textContent = bookTitle;
  document.getElementById("orderBookAuthor").textContent = bookAuthor || "";
  document.getElementById("orderBookImg").src = bookImage;
  [
    "orderFullName",
    "orderPhone",
    "orderEmail",
    "orderAddress",
    "orderCity",
    "orderCountry",
    "orderNotes",
    "orderMapSearch",
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("orderQty").value = qty;
  document.getElementById("orderError").textContent = "";
  document.getElementById("orderMapLabel").textContent =
    "No pin placed yet \u2014 click on the map to pin your location.";
  orderMarker = null;
  document.getElementById("orderModal").style.display = "flex";
  setTimeout(function () {
    if (!orderMap) {
      orderMap = L.map("orderMap").setView([41.9981, 21.4254], 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "\u00a9 OpenStreetMap contributors",
      }).addTo(orderMap);
      orderMap.on("click", function (ev) {
        placePin(ev.latlng.lat, ev.latlng.lng);
      });
    } else {
      if (orderMarker) {
        orderMap.removeLayer(orderMarker);
        orderMarker = null;
      }
      orderMap.invalidateSize();
    }
    var searchBtn = document.getElementById("orderMapSearchBtn");
    var searchInp = document.getElementById("orderMapSearch");
    if (searchBtn && searchInp) {
      var newBtn = searchBtn.cloneNode(true);
      searchBtn.parentNode.replaceChild(newBtn, searchBtn);
      newBtn.addEventListener("click", searchMapAddress);
      searchInp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") searchMapAddress();
      });
    }
  }, 120);
}

function placePin(lat, lng, label) {
  if (orderMarker) orderMap.removeLayer(orderMarker);
  orderMarker = L.marker([lat, lng]).addTo(orderMap);
  var displayLabel = label || lat.toFixed(5) + ", " + lng.toFixed(5);
  document.getElementById("orderMapLabel").textContent = "\ud83d\udccd Pinned: " + displayLabel;
}

function searchMapAddress() {
  var query = document.getElementById("orderMapSearch").value.trim();
  if (!query) return;
  var labelEl = document.getElementById("orderMapLabel");
  labelEl.textContent = "\ud83d\udd0d Searching...";
  fetch(
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
      encodeURIComponent(query) +
      "&limit=1",
    { headers: { "Accept-Language": "en" } }
  )
    .then(function (r) {
      return r.json();
    })
    .then(function (results) {
      if (!results || !results.length) {
        labelEl.textContent = "\u274c Address not found. Try a different search.";
        return;
      }
      var lat = results[0].lat;
      var lon = results[0].lon;
      var display_name = results[0].display_name;
      orderMap.setView([lat, lon], 15);
      placePin(parseFloat(lat), parseFloat(lon), display_name.substring(0, 60));
      var addrEl = document.getElementById("orderAddress");
      if (addrEl && !addrEl.value.trim()) addrEl.value = display_name.substring(0, 80);
    })
    .catch(function () {
      labelEl.textContent = "\u274c Search failed. Check your connection.";
    });
}

document.addEventListener("DOMContentLoaded", function () {
  var submitBtn = document.getElementById("orderSubmitBtn");
  if (!submitBtn) return;
  submitBtn.addEventListener("click", async function () {
    var errEl = document.getElementById("orderError");
    errEl.textContent = "";
    var title = document.getElementById("orderBookTitle").textContent.trim();
    var image = document.getElementById("orderBookImg").src;
    var bookId = (document.getElementById("orderBookId") || {}).value || "";
    var fullName = document.getElementById("orderFullName").value.trim();
    var phone = document.getElementById("orderPhone").value.trim();
    var email = document.getElementById("orderEmail").value.trim();
    var qty = parseInt(document.getElementById("orderQty").value, 10) || 0;
    var country = document.getElementById("orderCountry").value.trim();
    var city = document.getElementById("orderCity").value.trim();
    var address = document.getElementById("orderAddress").value.trim();
    var notes = document.getElementById("orderNotes").value.trim();
    if (!fullName) {
      errEl.textContent = "\u26a0 Full name is required.";
      return;
    }
    if (!phone) {
      errEl.textContent = "\u26a0 Phone number is required.";
      return;
    }
    if (qty < 1 || qty > 99) {
      errEl.textContent = "\u26a0 Quantity must be between 1 and 99.";
      return;
    }
    if (!country) {
      errEl.textContent = "\u26a0 Country is required.";
      return;
    }
    if (!city) {
      errEl.textContent = "\u26a0 City is required.";
      return;
    }
    if (!address && !orderMarker) {
      errEl.textContent =
        "\u26a0 Please enter a full address or pin your location on the map.";
      return;
    }
    var lat = orderMarker ? orderMarker.getLatLng().lat : null;
    var lng = orderMarker ? orderMarker.getLatLng().lng : null;
    var mapLink =
      lat && lng
        ? "https://www.openstreetmap.org/?mlat=" +
          lat +
          "&mlon=" +
          lng +
          "#map=17/" +
          lat +
          "/" +
          lng
        : "";
    var unit = 0;
    var fb = null;
    for (var i = 0; i < storefrontBooksCache.length; i++) {
      if (storefrontBooksCache[i].title === title) {
        fb = storefrontBooksCache[i];
        break;
      }
    }
    if (fb) unit = fb.discount > 0 ? fb.price : fb.originalPrice;
    var items = [
      {
        bookId: bookId || null,
        title: title,
        image: image,
        author: document.getElementById("orderBookAuthor").textContent.trim(),
        quantity: qty,
        unitPrice: unit,
      },
    ];
    var totalPrice = unit * qty;
    try {
      await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: items,
          fullName: fullName,
          phone: phone,
          email: email,
          address: address || "Pinned on map",
          country: country,
          city: city,
          notes: notes,
          lat: lat,
          lng: lng,
          mapLink: mapLink,
          totalPrice: totalPrice,
        }),
      });
      if (bookId) await apiFetch("/cart/" + bookId, { method: "DELETE" }).catch(function () {});
      else {
        var fresh = await getCartItems();
        var next = fresh.filter(function (x) {
          return x.title !== title;
        });
        await apiFetch("/cart", { method: "DELETE" });
        for (var j = 0; j < next.length; j++) {
          await apiFetch("/cart", {
            method: "POST",
            body: JSON.stringify({
              bookId: next[j].bookId || undefined,
              title: next[j].title,
              image: next[j].image,
              author: next[j].author,
              unitPrice: next[j].unitPrice,
              quantity: next[j].quantity,
            }),
          });
        }
      }
      updateCartBadge();
      document.getElementById("orderModal").style.display = "none";
      showWelcomeMsg(
        '\u2714 Order placed for "' + title + '"! We\'ll contact you at ' + phone + ".",
        5000
      );
    } catch (e) {
      errEl.textContent = e.message || "Order failed";
    }
  });

  var pt = sessionStorage.getItem("pendingOrderTitle");
  if (pt && isLoggedIn()) {
    var pi = sessionStorage.getItem("pendingOrderImage");
    var pa = sessionStorage.getItem("pendingOrderAuthor");
    var pb = sessionStorage.getItem("pendingOrderBookId") || "";
    var pu = parseFloat(sessionStorage.getItem("pendingOrderUnitPrice") || "0");
    var pq = parseInt(sessionStorage.getItem("pendingOrderQty") || "1", 10);
    sessionStorage.removeItem("pendingOrderTitle");
    sessionStorage.removeItem("pendingOrderImage");
    sessionStorage.removeItem("pendingOrderAuthor");
    sessionStorage.removeItem("pendingOrderBookId");
    sessionStorage.removeItem("pendingOrderUnitPrice");
    sessionStorage.removeItem("pendingOrderQty");
    setTimeout(function () {
      openOrderModal(pt, pi, pa, pb, pu, pq);
    }, 600);
  }
});

(function initHomeVideo() {
  var videoOverlay = document.getElementById("homeVideoOverlay");
  var videoElement = document.getElementById("homeVideo");
  var closeBtn = document.getElementById("closeVideoBtn");
  if (!videoOverlay || !videoElement) return;
  function openVideo() {
    videoOverlay.classList.add("active");
    videoElement.currentTime = 0;
    var p = videoElement.play();
    if (p && p.catch) p.catch(function () {});
  }
  function closeVideo() {
    videoOverlay.classList.remove("active");
    videoElement.pause();
  }
  document.querySelectorAll('a[href="#Home"], a[href="#ALPHA"], a[href="#home"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      openVideo();
    });
  });
  if (closeBtn)
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeVideo();
    });
  videoOverlay.addEventListener("click", function (e) {
    if (e.target === videoOverlay) closeVideo();
  });
  videoElement.addEventListener("ended", function () {
    closeVideo();
    window.location.hash = "ALPHA";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();

/* jQuery is only bundled on index.html; guard so admin.html (no jQuery) does not throw. */
if (typeof window.jQuery !== "undefined") {
  window.jQuery(document).ready(function () {
    window.jQuery("nav ul li a[href^='#']").on("click", function (event) {
      if (this.hash !== "") {
        event.preventDefault();
        var hash = this.hash;
        var target = window.jQuery(hash);
        if (target.length) {
          window.jQuery("html, body").animate(
            { scrollTop: target.offset().top },
            600,
            function () {
              window.location.hash = hash;
            }
          );
        }
      }
    });
    window.jQuery("footer .social_link i").hover(
      function () {
        window.jQuery(this).stop().fadeTo(200, 0.5);
      },
      function () {
        window.jQuery(this).stop().fadeTo(200, 1);
      }
    );
  });
}
/* part 2d: admin dashboard */
function isAdminDashboardPage() {
  var p = (window.location.pathname || "").replace(/\/+$/, "") || "/";
  if (/\/admin\.html$/i.test(p) || p.toLowerCase() === "/admin") return true;
  if (String(window.location.href || "").indexOf("admin.html") !== -1) return true;
  return false;
}

function whenDocumentReady(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}

(function initAdminDashboard() {
  if (!isAdminDashboardPage()) return;

  whenDocumentReady(async function () {
    console.log("[ALPHA admin] dashboard init", window.location.pathname, "hasToken=", !!getToken());
    var authBanner = document.getElementById("adminAuthBanner");
    function showAuthFailure(message) {
      var m = message || "You cannot access the admin dashboard.";
      if (authBanner) {
        authBanner.innerHTML =
          "<strong>Access denied.</strong> " +
          esc(m) +
          " You will be redirected to the home page to sign in.";
        authBanner.classList.add("is-visible");
      }
      setTimeout(function () {
        window.location.href = "index.html";
      }, 3200);
    }

    try {
      var me = await apiFetch("/auth/me", { method: "GET" });
      if (!me.user || me.user.role !== "admin") {
        showAuthFailure("Admin privileges are required. Please sign in with an administrator account.");
        return;
      }
      if (authBanner) {
        authBanner.classList.remove("is-visible");
        authBanner.innerHTML = "";
      }
    } catch (e) {
      var msg = (e && e.message) || "Authentication failed.";
      if (e && e.status === 401) msg = "Your session has expired or you are not signed in.";
      showAuthFailure(msg);
      return;
    }

    var adminBooks = [];
    /** When false, Book Management table shows first 3 rows only. Reset on each reloadAll(). */
    var showAllAdminBooks = false;

    function adminApiErrorHtml(title, err) {
      var msg = err && err.message ? String(err.message) : "Request failed";
      var url = err && err.url ? String(err.url) : "";
      var hint =
        err && err.status === 403
          ? " Admin role required. Sign out and sign in again with your admin account."
          : err && err.status === 401
            ? " Not signed in or session expired."
            : "";
      return (
        '<div class="admin-error-box"><strong>' +
        esc(title) +
        "</strong><p style=\"margin:8px 0 0;font-size:14px;\">" +
        esc(msg + hint) +
        (url ? '<br><small style="opacity:0.85;">URL: ' + esc(url) + "</small>" : "") +
        "</p></div>"
      );
    }

    async function reloadAll() {
      showAllAdminBooks = false;
      window.__adminBooksApiError = null;
      var statsEl = document.getElementById("adminDashboardStats");

      try {
        var stats = await apiFetch("/admin/dashboard-stats", { method: "GET" });
        if (!stats || typeof stats !== "object") throw new Error("Invalid stats response");
        if (statsEl) {
          console.log("[ALPHA admin] GET /admin/dashboard-stats", stats);
          var vu = Number(stats.totalVisibleBooks) || 0;
          var hi = Number(stats.totalHiddenBooks) || 0;
          statsEl.innerHTML =
            '<div class="admin-stats-grid">' +
            '<div class="admin-stat-item"><div class="stat-label">Total Users</div><div class="stat-value">' +
            Number(stats.totalUsers) +
            '</div></div><div class="admin-stat-item"><div class="stat-label">Total Books</div><div class="stat-value">' +
            Number(stats.totalBooks) +
            '</div><div class="stat-hint">Visible: ' +
            vu +
            " &middot; Hidden: " +
            hi +
            '</div></div><div class="admin-stat-item"><div class="stat-label">Total Orders</div><div class="stat-value">' +
            Number(stats.totalOrders) +
            '</div></div><div class="admin-stat-item"><div class="stat-label">Total Likes</div><div class="stat-value">' +
            Number(stats.totalLikes) +
            '</div></div><div class="admin-stat-item"><div class="stat-label">Total Reviews</div><div class="stat-value">' +
            Number(stats.totalReviews) +
            "</div></div></div>";
        }
      } catch (e) {
        console.warn(e);
        if (statsEl)
          statsEl.innerHTML = adminApiErrorHtml("Could not load dashboard statistics", e);
      }

      try {
        var users = await apiFetch("/users", { method: "GET" });
        if (!Array.isArray(users)) users = [];
        console.log("[ALPHA admin] GET /users count=", users.length);
        var usersMeta = document.getElementById("usersSectionMeta");
        var usersGrid = document.getElementById("usersGrid");
        if (usersMeta) usersMeta.textContent = "Total registered users: " + users.length;
        if (usersGrid) {
          usersGrid.innerHTML = "";
          if (!users.length) {
            usersGrid.innerHTML =
              '<div class="admin-empty-state">No registered users yet.</div>';
          } else
            users.forEach(function (u) {
              var card = document.createElement("div");
              card.className = "admin-card";
              card.innerHTML =
                '<span class="badge" style="background:' +
                (u.role === "admin" ? "#3e356b" : "#089da1") +
                ';">' +
                esc(u.role) +
                '</span><i class="fa-solid fa-user" style="font-size:40px;color:#ccc;margin:12px 0;display:block;"></i><h3>' +
                esc(u.name) +
                "</h3><p>" +
                esc(u.email) +
                "</p>";
              usersGrid.appendChild(card);
            });
        }
      } catch (e) {
        console.warn(e);
        var usersMetaE = document.getElementById("usersSectionMeta");
        var usersGridE = document.getElementById("usersGrid");
        if (usersMetaE)
          usersMetaE.textContent = "Could not load user totals.";
        if (usersGridE) usersGridE.innerHTML = adminApiErrorHtml("Could not load registered users", e);
      }

      try {
        var orders = await apiFetch("/orders", { method: "GET" });
        if (!Array.isArray(orders)) orders = [];
        console.log("[ALPHA admin] GET /orders count=", orders.length);
        var ordersMeta = document.getElementById("ordersSectionMeta");
        var ordersGrid = document.getElementById("ordersGrid");
        if (ordersMeta) ordersMeta.textContent = "Total orders: " + orders.length;
        if (ordersGrid) {
          ordersGrid.innerHTML = "";
          if (!orders.length) {
            ordersGrid.innerHTML = '<div class="admin-empty-state">No orders yet.</div>';
          } else
            orders.forEach(function (o, idx) {
              var date = new Date(o.createdAt || Date.now()).toLocaleString();
              var mapHref =
                o.mapLink ||
                (o.lat && o.lng
                  ? "https://www.openstreetmap.org/?mlat=" +
                    o.lat +
                    "&mlon=" +
                    o.lng +
                    "#map=17/" +
                    o.lat +
                    "/" +
                    o.lng
                  : "");
              var mapBtn = mapHref
                ? '<a href="' +
                  esc(mapHref) +
                  '" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:6px 14px;background:#089da1;color:#fff;border-radius:20px;font-size:12px;text-decoration:none;font-weight:bold;">Open map</a>'
                : '<span style="font-size:12px;color:#aaa;">No map pin</span>';
              var itemsHtml = (o.items || [])
                .map(function (it) {
                  return esc(it.title) + " x" + (it.quantity || 1);
                })
                .join(", ");
              var card = document.createElement("div");
              card.className = "admin-card";
              var img = o.items && o.items[0] ? o.items[0].image : "image/book_1.jpg";
              card.innerHTML =
                '<span class="badge" style="background:#3e356b;">Order #' +
                (idx + 1) +
                " - " +
                esc(o.username) +
                '</span><img src="' +
                esc(img) +
                '" alt=""><h3>' +
                esc(itemsHtml || "Order") +
                '</h3><div class="admin-order-card-inner">' +
                "<p><strong>Customer:</strong> " +
                esc(o.fullName) +
                "</p>" +
                "<p><strong>Phone:</strong> " +
                esc(o.phone) +
                "</p>" +
                "<p><strong>Email:</strong> " +
                esc(o.email || "-") +
                "</p>" +
                "<p><strong>Address:</strong> " +
                esc(o.address) +
                "</p>" +
                "<p><strong>Total:</strong> $" +
                Number(o.totalPrice).toFixed(2) +
                "</p>" +
                "<p><strong>Status:</strong> " +
                esc(o.status) +
                "</p>" +
                mapBtn +
                '<p style="font-size:11px;color:#bbb;margin-top:8px;">' +
                esc(date) +
                "</p></div>";
              ordersGrid.appendChild(card);
            });
        }
      } catch (e) {
        console.warn(e);
        var ordersMetaE = document.getElementById("ordersSectionMeta");
        var ordersGridE2 = document.getElementById("ordersGrid");
        if (ordersMetaE) ordersMetaE.textContent = "Could not load order totals.";
        if (ordersGridE2) ordersGridE2.innerHTML = adminApiErrorHtml("Could not load book orders", e);
      }

      try {
        var booksRes = await apiFetch("/admin/books", { method: "GET" });
        adminBooks = Array.isArray(booksRes) ? booksRes : [];
        console.log("[ALPHA admin] GET /admin/books count=", adminBooks.length);
      } catch (e) {
        console.warn(e);
        adminBooks = [];
        window.__adminBooksApiError = (e && e.message) || "Could not load books";
      }
      renderAdminTable();

      try {
        var likes = await apiFetch("/likes", { method: "GET" });
        if (!Array.isArray(likes)) likes = [];
        console.log("[ALPHA admin] GET /likes count=", likes.length);
        var likesMeta = document.getElementById("likesSectionMeta");
        var likesGrid = document.getElementById("likesGrid");
        if (likesMeta) likesMeta.textContent = "Total likes: " + likes.length;
        if (likesGrid) {
          likesGrid.innerHTML = "";
          if (!likes.length) {
            likesGrid.innerHTML = '<div class="admin-empty-state">No likes yet.</div>';
          } else
            likes.forEach(function (like) {
              var d = like.createdAt ? new Date(like.createdAt).toLocaleString() : "";
              var userName = "";
              if (like.userId && typeof like.userId === "object") {
                userName = like.userId.name || like.userId.email || "";
              }
              if (!userName) userName = "User";
              var card = document.createElement("div");
              card.className = "admin-card";
              card.innerHTML =
                '<span class="badge" style="background:#e74c3c;">Like</span><p style="font-size:13px;color:#555;margin:8px 0;"><strong>' +
                esc(userName) +
                '</strong> liked:</p><h3>' +
                esc(like.bookTitle) +
                '</h3><p style="font-size:12px;color:#999;">' +
                esc(d) +
                "</p>";
              likesGrid.appendChild(card);
            });
        }
      } catch (e) {
        console.warn(e);
        var likesMetaE = document.getElementById("likesSectionMeta");
        var likesGridE = document.getElementById("likesGrid");
        if (likesMetaE) likesMetaE.textContent = "Could not load like totals.";
        if (likesGridE) likesGridE.innerHTML = adminApiErrorHtml("Could not load likes", e);
      }

      try {
        var reviews = await apiFetch("/reviews", { method: "GET" });
        if (!Array.isArray(reviews)) reviews = [];
        console.log("[ALPHA admin] GET /reviews count=", reviews.length);
        var reviewsMeta = document.getElementById("reviewsSectionMeta");
        var reviewsGrid = document.getElementById("reviewsGrid");
        if (reviewsMeta) reviewsMeta.textContent = "Total reviews: " + reviews.length;
        if (reviewsGrid) {
          reviewsGrid.innerHTML = "";
          if (!reviews.length) {
            reviewsGrid.innerHTML = '<div class="admin-empty-state">No reviews yet.</div>';
          } else
            reviews.forEach(function (r) {
              var rc = Math.min(5, Math.max(0, Math.floor(Number(r.rating) || 0)));
              var starsHtml = "";
              for (var si = 0; si < rc; si++) starsHtml += '<i class="fa-solid fa-star" style="color:#f59e0b;"></i>';
              var rid = r._id != null ? String(r._id) : "";
              var card = document.createElement("div");
              card.className = "admin-card";
              card.innerHTML =
                '<span class="badge" style="background:#089da1;">' +
                esc(r.username) +
                " - " +
                esc(r.bookTitle || "") +
                '</span><div style="margin:10px 0;">' +
                starsHtml +
                '</div><p style="font-style:italic;color:#555;margin:0 0 10px;">"' +
                esc(r.comment) +
                '"</p>' +
                '<button type="button" class="action-btn btn-delete admin-delete-review" data-id="' +
                esc(rid) +
                '">Delete</button>';
              reviewsGrid.appendChild(card);
            });
        }
      } catch (e) {
        console.warn(e);
        var reviewsMetaE = document.getElementById("reviewsSectionMeta");
        var reviewsGridE = document.getElementById("reviewsGrid");
        if (reviewsMetaE) reviewsMetaE.textContent = "Could not load review totals.";
        if (reviewsGridE) reviewsGridE.innerHTML = adminApiErrorHtml("Could not load reviews", e);
      }
    }

    function renderAdminTable() {
      var bookManagementTbody = document.getElementById("bookManagementTbody");
      var toggleWrap = document.getElementById("adminBookListToggleWrap");
      var toggleBtn = document.getElementById("adminBookListToggleBtn");
      var summaryEl = document.getElementById("bookManagementSummary");
      if (!bookManagementTbody) return;
      bookManagementTbody.innerHTML = "";
      if (summaryEl) summaryEl.textContent = "";
      if (toggleWrap) toggleWrap.style.display = "none";
      if (window.__adminBooksApiError) {
        bookManagementTbody.innerHTML =
          "<tr><td colspan='6'>" +
          adminApiErrorHtml("Could not load books from API", { message: window.__adminBooksApiError }) +
          "</td></tr>";
        return;
      }
      if (!adminBooks.length) {
        bookManagementTbody.innerHTML =
          "<tr><td colspan='6'><div class=\"admin-empty-state\">No books found. Click <strong>Reset Catalog</strong> above to restore the default catalog.</div></td></tr>";
        return;
      }
      var total = adminBooks.length;
      if (summaryEl) {
        if (total <= 3) {
          summaryEl.textContent = "Showing all " + total + " book" + (total === 1 ? "" : "s") + " in the catalog.";
        } else if (showAllAdminBooks) {
          summaryEl.textContent = "Showing all " + total + " books.";
        } else {
          summaryEl.textContent = "Preview: showing 3 of " + total + " books. Use Show All Books to see the full catalog.";
        }
      }
      if (toggleWrap && toggleBtn && total > 3) {
        toggleWrap.style.display = "block";
        toggleBtn.textContent = showAllAdminBooks ? "Show Less" : "Show All Books";
      }
      adminBooks.forEach(function (b, idx) {
        if (!showAllAdminBooks && idx >= 3) return;
        var statusBadge = b.isHidden
          ? '<span class="status-badge status-hidden">Hidden</span>'
          : '<span class="status-badge status-visible">Visible</span>';
        var disc = Number(b.discount) || 0;
        var orig = Number(b.originalPrice);
        var fin = Number(b.price);
        var bid = b._id != null ? String(b._id) : "";
        var priceHTML =
          disc > 0
            ? "<div style=\"font-weight:bold;color:#e74c3c;font-size:16px;\">$" +
              fin.toFixed(2) +
              '</div><div style="text-decoration:line-through;color:#999;font-size:12px;">$' +
              orig.toFixed(2) +
              '</div><span style="display:inline-block;background:#e74c3c;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;margin-top:4px;">' +
              disc +
              "% OFF</span>"
            : '<div style="font-weight:bold;color:#333;font-size:16px;">$' + orig.toFixed(2) + "</div>";
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td><img src=\"" +
          esc(b.image) +
          '" alt="" class="admin-table-img"></td><td><strong>' +
          esc(b.title) +
          '</strong><br><small style="color:#666;">By: ' +
          esc(b.author) +
          '</small><br><small style="color:#089da1;">' +
          esc(b.genre || "") +
          "</small></td><td>" +
          priceHTML +
          '</td><td>' +
          esc(String(b.rating)) +
          ' /5</td><td>' +
          statusBadge +
          '</td><td><button type="button" class="action-btn btn-edit" data-bookid="' +
          esc(bid) +
          '">Edit</button> ' +
          (b.isHidden
            ? '<button type="button" class="action-btn btn-show" data-bookid="' + esc(bid) + '">View</button> '
            : '<button type="button" class="action-btn btn-hide" data-bookid="' + esc(bid) + '">Hide</button> ') +
          '<button type="button" class="action-btn btn-delete" data-bookid="' +
          esc(bid) +
          '">Delete</button></td>';
        bookManagementTbody.appendChild(tr);
      });
    }

    var adminBookListToggleBtn = document.getElementById("adminBookListToggleBtn");
    if (adminBookListToggleBtn) {
      adminBookListToggleBtn.addEventListener("click", function () {
        showAllAdminBooks = !showAllAdminBooks;
        renderAdminTable();
      });
    }

    var bookMgmtTbody = document.getElementById("bookManagementTbody");
    if (bookMgmtTbody) {
      bookMgmtTbody.addEventListener("click", async function (e) {
      var btn = e.target.closest(".btn-hide");
      var showB = e.target.closest(".btn-show");
      var del = e.target.closest(".btn-delete");
      var edit = e.target.closest(".btn-edit");
      var rowBtn = btn || showB || del || edit;
      if (!rowBtn) return;
      var id = rowBtn.dataset.bookid;
      if (!id) return;
      try {
        if (btn) {
          await apiFetch("/books/" + id + "/hide", { method: "PATCH" });
          alert("Book hidden.");
        } else if (showB) {
          await apiFetch("/books/" + id + "/show", { method: "PATCH" });
          alert("Book visible.");
        } else if (del) {
          if (!confirm("Permanently delete this book from MongoDB? Related likes and reviews for this book will be removed.")) return;
          await apiFetch("/books/" + id, { method: "DELETE" });
          alert("Book deleted from the database.");
        } else if (edit) {
          var b = adminBooks.find(function (x) {
            return String(x._id) === id;
          });
          if (!b) return;
          document.getElementById("editBookId").value = String(b._id);
          document.getElementById("editBookTitle").value = b.title;
          document.getElementById("editBookAuthor").value = b.author;
          document.getElementById("editBookGenre").value = b.genre || "";
          document.getElementById("editBookCategories").value = (b.categories || []).join(", ");
          document.getElementById("editBookImage").value = b.image;
          document.getElementById("editBookDescription").value = b.description || "";
          document.getElementById("editBookPrice").value = b.originalPrice;
          document.getElementById("editBookDiscount").value = b.discount || "";
          document.getElementById("editBookRating").value = b.rating;
          updateEditFinalPriceAdmin();
          document.getElementById("adminEditBookOverlay").classList.add("show");
          return;
        }
        await reloadAll();
        try {
          await refreshStorefrontBooks();
        } catch (_) {}
      } catch (err) {
        alert(err.message || "Action failed");
      }
    });
    }

    function updateEditFinalPriceAdmin() {
      var p = parseFloat(document.getElementById("editBookPrice").value) || 0;
      var d = parseInt(document.getElementById("editBookDiscount").value, 10) || 0;
      document.getElementById("editBookFinalPrice").textContent = "$" + (p * (1 - d / 100)).toFixed(2);
    }
    var editPriceEl = document.getElementById("editBookPrice");
    var editDiscEl = document.getElementById("editBookDiscount");
    if (editPriceEl) editPriceEl.addEventListener("input", updateEditFinalPriceAdmin);
    if (editDiscEl) editDiscEl.addEventListener("input", updateEditFinalPriceAdmin);

    var adminCloseEditBtn = document.getElementById("adminCloseEditBookBtn");
    if (adminCloseEditBtn) {
      adminCloseEditBtn.addEventListener("click", function () {
        document.getElementById("adminEditBookOverlay").classList.remove("show");
      });
    }

    function wireAdminModalOverlay(overlayId) {
      var ov = document.getElementById(overlayId);
      if (!ov) return;
      ov.addEventListener("click", function (e) {
        if (e.target === ov) ov.classList.remove("show");
      });
    }
    wireAdminModalOverlay("adminEditBookOverlay");
    wireAdminModalOverlay("addBookModal");

    var adminEditForm = document.getElementById("adminEditBookForm");
    if (adminEditForm) {
      adminEditForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var id = document.getElementById("editBookId").value;
      var cats = document
        .getElementById("editBookCategories")
        .value.split(",")
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      var body = {
        title: document.getElementById("editBookTitle").value.trim(),
        author: document.getElementById("editBookAuthor").value.trim(),
        genre: document.getElementById("editBookGenre").value.trim(),
        categories: cats,
        image: document.getElementById("editBookImage").value.trim(),
        description: document.getElementById("editBookDescription").value.trim(),
        originalPrice: parseFloat(document.getElementById("editBookPrice").value),
        discount: parseInt(document.getElementById("editBookDiscount").value, 10) || 0,
        rating: parseFloat(document.getElementById("editBookRating").value),
      };
      try {
        await apiFetch("/books/" + id, { method: "PUT", body: JSON.stringify(body) });
        alert("Book updated.");
        document.getElementById("adminEditBookOverlay").classList.remove("show");
        await reloadAll();
        try {
          await refreshStorefrontBooks();
        } catch (_) {}
      } catch (err) {
        alert(err.message || "Update failed");
      }
    });
    }

    var reviewsGridEl = document.getElementById("reviewsGrid");
    if (reviewsGridEl) {
      reviewsGridEl.addEventListener("click", async function (e) {
      var b = e.target.closest(".admin-delete-review");
      if (!b) return;
      var rid = b.dataset.id;
      if (!confirm("Delete this review?")) return;
      try {
        await apiFetch("/reviews/" + encodeURIComponent(rid), { method: "DELETE" });
        await reloadAll();
      } catch (err) {
        alert(err.message || "Delete failed");
      }
    });
    }

    var resetCatBtn = document.getElementById("resetCatalogBtn");
    if (resetCatBtn) {
      resetCatBtn.addEventListener("click", async function () {
      if (
        !confirm(
          "Reset the catalog to the 15 default books? This clears all books, reviews, orders, carts, and likes in MongoDB. User accounts are kept."
        )
      )
        return;
      try {
        await apiFetch("/admin/reset-catalog", { method: "POST", body: "{}" });
        alert("Catalog reset.");
        await reloadAll();
        await refreshStorefrontBooks();
      } catch (err) {
        alert(err.message || "Reset failed");
      }
    });
    }

    var adminAddBookBtn = document.getElementById("adminAddBookBtn");
    var addBookModal = document.getElementById("addBookModal");
    var adminCloseAddBtn = document.getElementById("adminCloseAddBookBtn");
    if (adminCloseAddBtn && addBookModal) {
      adminCloseAddBtn.addEventListener("click", function (e) {
        e.preventDefault();
        addBookModal.classList.remove("show");
      });
    }
    if (adminAddBookBtn && addBookModal) {
      adminAddBookBtn.addEventListener("click", function () {
        addBookModal.classList.add("show");
      });
    }

    document.querySelectorAll(".category-checkbox-label input[type='checkbox']").forEach(function (cb) {
      cb.addEventListener("change", function () {
        this.closest(".category-checkbox-label").classList.toggle("checked", this.checked);
      });
    });

    function updateAddBookFinalPrice() {
      var p = parseFloat(document.getElementById("adminBookPrice").value) || 0;
      var d = parseInt(document.getElementById("adminBookDiscount").value, 10) || 0;
      document.getElementById("adminBookFinalPriceDisplay").textContent =
        "$" + (p * (1 - d / 100)).toFixed(2);
    }
    var adminBookPriceEl = document.getElementById("adminBookPrice");
    var adminBookDiscEl = document.getElementById("adminBookDiscount");
    if (adminBookPriceEl) adminBookPriceEl.addEventListener("input", updateAddBookFinalPrice);
    if (adminBookDiscEl) adminBookDiscEl.addEventListener("input", updateAddBookFinalPrice);

    var adminAddBookFormEl = document.getElementById("adminAddBookForm");
    if (adminAddBookFormEl) {
      adminAddBookFormEl.addEventListener("submit", async function (e) {
      e.preventDefault();
      var checkedBoxes = document.querySelectorAll("#categoryCheckboxGroup input[type='checkbox']:checked");
      var categories = Array.from(checkedBoxes).map(function (cb) {
        return cb.value;
      });
      var categoryError = document.getElementById("categoryError");
      categoryError.textContent = "";
      if (!categories.length) {
        categoryError.textContent = "Please select at least one category.";
        return;
      }
      var body = {
        title: document.getElementById("adminBookTitle").value.trim(),
        author: document.getElementById("adminBookAuthor").value.trim(),
        originalPrice: parseFloat(document.getElementById("adminBookPrice").value),
        discount: parseInt(document.getElementById("adminBookDiscount").value, 10) || 0,
        rating: parseFloat(document.getElementById("adminBookRating").value),
        image: document.getElementById("adminBookImage").value.trim(),
        description: document.getElementById("adminBookSummary").value.trim(),
        categories: categories,
        genre: categories.join(", "),
      };
      try {
        await apiFetch("/books", { method: "POST", body: JSON.stringify(body) });
        alert("Book added.");
        addBookModal.classList.remove("show");
        document.getElementById("adminAddBookForm").reset();
        document.querySelectorAll(".category-checkbox-label").forEach(function (l) {
          l.classList.remove("checked");
        });
        await reloadAll();
        try {
          await refreshStorefrontBooks();
        } catch (_) {}
      } catch (err) {
        alert(err.message || "Add failed");
      }
    });
    }

    var olQueryInput = document.getElementById("openLibraryQuery");
    var olFetchBtn = document.getElementById("openLibraryFetchBtn");
    var olRandomBtn = document.getElementById("openLibraryRandomBtn");
    var olStatus = document.getElementById("openLibraryStatus");
    function showOLStatus(msg, isError) {
      if (!olStatus) return;
      olStatus.textContent = msg;
      olStatus.style.color = isError ? "#e74c3c" : "#089da1";
      olStatus.style.display = "block";
    }
    function clearOLStatus() {
      if (olStatus) olStatus.style.display = "none";
    }
    var categoryMapping = {
      Fiction: ["fiction", "novel", "literature"],
      Romance: ["romance", "love"],
      Mystery: ["mystery", "detective", "thriller", "crime"],
      Fantasy: ["fantasy", "magic", "wizard"],
      Science: ["science", "physics", "biology"],
      Technology: ["technology", "computers", "software"],
      History: ["history", "historical", "biography"],
      Business: ["business", "economics", "finance"],
      Horror: ["horror", "ghost", "supernatural"],
      "Self-development": ["self-help", "psychology", "motivation", "spirituality"],
    };
    function mapSubjects(subjects) {
      if (!subjects) return [];
      var matched = [];
      var lowerSubjects = subjects.map(function (s) {
        return s.toLowerCase();
      });
      Object.keys(categoryMapping).forEach(function (cat) {
        var keywords = categoryMapping[cat];
        if (
          lowerSubjects.some(function (ls) {
            return keywords.some(function (kw) {
              return ls.indexOf(kw) !== -1;
            });
          })
        )
          matched.push(cat);
      });
      return matched;
    }
    async function fetchFromOpenLibrary(query, isRandom) {
      clearOLStatus();
      if (!olFetchBtn || !olRandomBtn) return;
      if (!query && !isRandom) {
        showOLStatus("Please enter a book title or author.");
        return;
      }
      olFetchBtn.disabled = true;
      olRandomBtn.disabled = true;
      olFetchBtn.textContent = "Loading...";
      try {
        var url =
          "https://openlibrary.org/search.json?q=" +
          encodeURIComponent(query || "fiction") +
          "&limit=" +
          (isRandom ? "40" : "10");
        if (isRandom) {
          var terms = ["bestseller", "classic", "fiction", "award"];
          url =
            "https://openlibrary.org/search.json?q=" +
            terms[Math.floor(Math.random() * terms.length)] +
            "&limit=40";
        }
        var response = await fetch(url);
        if (!response.ok) throw new Error("API error");
        var data = await response.json();
        if (!data.docs || !data.docs.length) {
          showOLStatus("No book found.");
          return;
        }
        var doc = isRandom
          ? data.docs[Math.floor(Math.random() * data.docs.length)]
          : data.docs[0];
        document.getElementById("adminBookTitle").value = doc.title || "";
        document.getElementById("adminBookAuthor").value =
          doc.author_name && doc.author_name[0] ? doc.author_name[0] : "";
        document.getElementById("adminBookRating").value = doc.ratings_average
          ? doc.ratings_average.toFixed(1)
          : "4.5";
        if (doc.cover_i)
          document.getElementById("adminBookImage").value =
            "https://covers.openlibrary.org/b/id/" + doc.cover_i + "-L.jpg";
        else document.getElementById("adminBookImage").value = "";
        var matchedCats = mapSubjects(doc.subject || []);
        document.querySelectorAll("#categoryCheckboxGroup input[type='checkbox']").forEach(function (cb) {
          cb.checked = matchedCats.indexOf(cb.value) !== -1;
          cb.closest(".category-checkbox-label").classList.toggle("checked", cb.checked);
        });
        if (doc.key) {
          try {
            var workRes = await fetch("https://openlibrary.org" + doc.key + ".json");
            if (workRes.ok) {
              var workData = await workRes.json();
              var desc = workData.description;
              if (desc && typeof desc === "object") desc = desc.value;
              document.getElementById("adminBookSummary").value = desc || "";
            }
          } catch (e2) {}
        }
        showOLStatus("Data filled successfully.", false);
      } catch (err) {
        showOLStatus("OpenLibrary error. Check your connection.");
      } finally {
        olFetchBtn.disabled = false;
        olRandomBtn.disabled = false;
        olFetchBtn.textContent = "Search / Fetch";
      }
    }
    if (olFetchBtn && olRandomBtn && olQueryInput) {
      olFetchBtn.addEventListener("click", function () {
        fetchFromOpenLibrary(olQueryInput.value.trim(), false);
      });
      olRandomBtn.addEventListener("click", function () {
        fetchFromOpenLibrary("", true);
      });
      olQueryInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          olFetchBtn.click();
        }
      });
    }

    await reloadAll();
  });
})();
