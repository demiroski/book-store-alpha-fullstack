# ALPHA Book Store

**ALPHA Book Store** is a full-stack interactive bookstore web application developed for the **Multimedia and Web Design** course at International Balkan University.

The project includes a responsive online bookstore frontend, user authentication, a shopping cart, book ordering, reviews, likes, and a complete admin dashboard for managing the store catalog, users, orders, and system data.

This project was built as a complete web application using:

- HTML5
- CSS3
- JavaScript
- jQuery
- Fetch API / AJAX
- Node.js
- Express.js
- MongoDB Atlas
- JWT Authentication

---

## Project Objective

The objective of ALPHA Book Store is to create a functional, visually appealing, and interactive web application where users can browse books, view book details, create accounts, like books, add books to a cart, and place orders.

The project also includes an admin dashboard that allows administrators to manage books, users, orders, reviews, and catalog visibility.

This demonstrates frontend development, backend development, database integration, API design, authentication, multimedia design, responsive layout, and version control using GitHub.

---

## Team Members and Roles

| Team Member | Role | Main Responsibilities |
|---|---|---|
| Adam Demiroski | Full-Stack Developer | Frontend, backend, database, authentication, admin dashboard, API integration, testing, documentation |
| Add teammate name here | Frontend / UI Designer | Add contribution here |
| Add teammate name here | Tester / Content Manager | Add contribution here |

> Replace the placeholder names with your real team members before submission.

---

## Main Features

### Storefront Features

- Responsive homepage
- Featured books section
- Coming Soon / Arrivals books section
- Book details modal
- Book images and descriptions
- Search panel for finding books
- Like system for users
- Cart system
- Order form
- Review system
- Login and sign-up system
- Welcome message after login
- Admin page link shown only for admin users
- Multimedia content including images, icons, and video elements

### User Features

- User registration
- User login
- JWT-based login state
- Like books
- View liked books
- Add books to cart
- Remove books from cart
- Place book orders
- Submit reviews

### Admin Dashboard Features

- Admin login
- Dashboard statistics
- View registered users
- View book orders
- Add new books
- Edit book information
- Update price, discount, and rating
- Hide books from the storefront
- Show hidden books again
- Delete books from the database
- Delete reviews
- Reset catalog to default data
- Manage store data through protected admin routes

---

## Technologies and Libraries Used

### Frontend

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 | Styling, layout, transitions, animations |
| JavaScript | Interactivity and application logic |
| jQuery | DOM manipulation, events, and animations |
| Fetch API | Communication with backend REST API |
| LocalStorage / SessionStorage | Temporary browser-side state such as auth/session helpers |
| Font Awesome | Icons |
| Boxicons | Login and UI icons |
| Leaflet | Map integration |
| HTML5 Video | Multimedia content |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime for backend |
| Express.js | REST API server |
| MongoDB Atlas | Cloud database |
| Mongoose | MongoDB object modeling |
| bcryptjs | Password hashing |
| JSON Web Token | Authentication and protected routes |
| CORS | Frontend-backend communication |
| dotenv | Environment variable management |
| nodemon | Development server auto-restart |

---

## Project Structure

```txt
ALPHA-Book-Store/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   └── test-admin-flows.js
│
├── Book store ALPHA the last version.(10)/
│   └── Book Store ALPHA/
│       ├── index.html
│       ├── admin.html
│       ├── script.js
│       ├── style.css
│       ├── arrivales_1.css
│       ├── arrivales_1.html
│       ├── arrivales_2.html
│       ├── ...
│       └── image/
│
├── README.md
├── README_BACKEND.md
├── .gitignore
└── serve.json
