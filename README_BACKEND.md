# ALPHA Book Store — Backend & API

This document describes the Node.js + Express + MongoDB Atlas API in the `backend` folder and how it works with the static frontend in `Book Store ALPHA`.

## 1. Install backend dependencies

```powershell
cd "c:\Users\adamd\Desktop\Book store ALPHA the last version.104\backend"
npm install
```

## 2. Create a MongoDB Atlas database

1. Sign in at [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a cluster (free tier is fine).
3. Database Access: create a database user (username + password).
4. Network Access: add your IP (or `0.0.0.0/0` for development only).
5. Clusters → Connect → Drivers → copy the **SRV connection string**.
6. Replace `<password>` with your user’s password and set a database name, e.g. `alpha_book_store`:

`mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/alpha_book_store?retryWrites=true&w=majority`

## 3. Create the `.env` file

Copy `backend/.env.example` to `backend/.env` and fill in real values (do not commit `.env`).

Required:

- `MONGODB_URI` — Atlas connection string (see above).
- `JWT_SECRET` — at least 16 random characters.

Optional overrides:

- `PORT` (default `5000`)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` — seed admin account
- `FRONTEND_URL` — extra allowed CORS origin (e.g. production site)

## 4. Run the backend

```powershell
cd "c:\Users\adamd\Desktop\Book store ALPHA the last version.104\backend"
npm run dev
```

API base: `http://localhost:5000/api`

## 5. Run the frontend

From the folder that contains `index.html` (your project uses a nested path):

```powershell
cd "c:\Users\adamd\Desktop\Book store ALPHA the last version.104\Book store ALPHA the last version.(10)\Book Store ALPHA"
npx --yes serve -p 3000
```

Open `http://localhost:3000`.

The frontend uses `const API_BASE_URL = "http://localhost:5000/api";` in `script.js`.

## 6. Test the health endpoint

Browser or curl:

`http://localhost:5000/api/health`

Expected JSON:

```json
{ "ok": true, "service": "ALPHA Book Store API" }
```

## 7. Test the public books endpoint

`http://localhost:5000/api/books`

Returns visible, non-deleted books for the storefront.

## 8. Admin login

After the server connects to Atlas and seeds:

- **Email:** `demiroski@webalpha.com` (or the value of `ADMIN_EMAIL` in `.env`)
- **Password:** `12345` (or `ADMIN_PASSWORD`)

Use the normal Login tab on the homepage with **email + password**. Admins are redirected to `admin.html`.

## 9. Reset Catalog

In the admin dashboard, **System Actions → Reset Catalog**:

1. Confirms with the user.
2. Calls `POST /api/admin/reset-catalog` with an admin JWT.
3. Deletes **all** documents in `books`, then inserts the **15 default books** from `utils/seed.js` (same data as initial seed).
4. Clears `reviews`, `orders`, `carts`, and `likes`.
5. **Does not** delete users (including the admin account).

After success, the UI reloads data from the API.

## 10. API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/register` | No | Register user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Bearer | Current user |
| GET | `/api/users` | Admin | List users (no passwords) |
| GET | `/api/books` | No | Storefront books (`isHidden` false, `isDeleted` false) |
| GET | `/api/books/:id` | No | One visible book |
| GET | `/api/books/admin/all` | Admin | All non-deleted books |
| POST | `/api/books` | Admin | Create book |
| PUT | `/api/books/:id` | Admin | Update book |
| PATCH | `/api/books/:id/hide` | Admin | Hide book |
| PATCH | `/api/books/:id/show` | Admin | Show book |
| DELETE | `/api/books/:id` | Admin | Soft-delete (`isDeleted`) |
| GET | `/api/reviews` | No | List reviews |
| GET | `/api/reviews/book/:bookId` | No | Reviews for a book |
| POST | `/api/reviews` | User | Create review |
| DELETE | `/api/reviews/:id` | Admin | Delete review |
| GET | `/api/orders` | User / Admin | User: own orders; Admin: all |
| POST | `/api/orders` | User | Create order |
| PATCH | `/api/orders/:id/status` | Admin | Update order status |
| GET | `/api/cart` | User | Current cart |
| POST | `/api/cart` | User | Add / merge line |
| DELETE | `/api/cart/:bookId` | User | Remove line (Mongo `bookId`) |
| DELETE | `/api/cart` | User | Clear cart |
| GET | `/api/likes` | User / Admin | User: own likes; Admin: all |
| POST | `/api/likes/:bookId` | User | Like a catalog book |
| DELETE | `/api/likes/:bookId` | User | Unlike |
| GET | `/api/admin/books` | Admin | Same as admin book list |
| GET | `/api/admin/dashboard-stats` | Admin | Counts for dashboard |
| POST | `/api/admin/reset-catalog` | Admin | Reset catalog + clear store data |

## 11. Deploy backend (e.g. Render)

1. Push the repo to GitHub.
2. On [Render](https://render.com), create a **Web Service**, root directory `backend`, build `npm install`, start `npm start`.
3. Set environment variables in the dashboard (`MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, admin vars).
4. Use the Render URL as the API host (e.g. `https://your-api.onrender.com/api`).

## 12. Deploy frontend (Netlify or GitHub Pages)

1. Upload or build the static `Book Store ALPHA` folder.
2. Set site to serve `index.html` for SPA-style paths if needed (this project is mostly static HTML).
3. Ensure the deployed site origin is allowed by CORS on the backend (`FRONTEND_URL` + explicit origins in `server.js` if you extend the list).

## 13. Change `API_BASE_URL` after deployment

In `script.js`, set:

```javascript
const API_BASE_URL = "https://your-api.onrender.com/api";
```

Rebuild/redeploy the frontend. Keep backend CORS origins in sync with your real frontend URL.

---

## Troubleshooting

- **`querySrv ECONNREFUSED` / DNS:** `server.js` sets Google/Cloudflare DNS before connecting (as requested).
- **Missing env:** Server exits with a clear message if `MONGODB_URI` is missing or if `JWT_SECRET` is missing or shorter than 16 characters.
- **404 API routes:** JSON body includes `message` and `path`.
