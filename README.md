# ALPHA Book Store

A full-stack bookstore demo: static HTML/CSS/JS storefront plus a **Node.js + Express + MongoDB** REST API (JWT auth, cart, orders, reviews, likes, admin tools).

## Repository layout

| Path | Role |
|------|------|
| `backend/` | API (`server.js`), Mongoose models, routes |
| `Book store ALPHA the last version.(10)/Book Store ALPHA/` | Static site (`index.html`, `admin.html`, `script.js`, assets) |

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster and connection string

## Quick start

### 1. Backend

```powershell
cd backend
npm install
copy .env.example .env
```

Edit `backend/.env`: set **`MONGODB_URI`** and a **`JWT_SECRET`** of at least 16 characters (see `.env.example` for optional admin and CORS settings).

```powershell
npm run dev
```

API listens on **http://localhost:5000** (default). Health check: [http://localhost:5000/api/health](http://localhost:5000/api/health).

### 2. Frontend

Serve the static folder on **port 3000** so it matches API CORS defaults:

```powershell
cd "Book store ALPHA the last version.(10)/Book Store ALPHA"
npx --yes serve -p 3000
```

Open **http://localhost:3000**. The client uses `API_BASE_URL` in `script.js` (default `http://localhost:5000/api`). Change that value when you deploy the API to another host.

### 3. Admin (after seed)

Default admin credentials come from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.example`). Sign in with **email + password** on the site; admins are sent to `admin.html`.

## Documentation

- **[README_BACKEND.md](README_BACKEND.md)** — environment variables, endpoints table, catalog reset, deployment notes, troubleshooting.

## License

Use and modify for your own learning or projects; add a license file if you plan to distribute the code.
