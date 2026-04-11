# Blogify

A full-stack blogging platform built with Node.js, Express, MongoDB, and EJS. Users can create, edit, and delete blog posts with cover image support via Cloudinary — all behind a secure authentication layer.

---

## Features

- User registration and login with JWT/cookie-based authentication
- Full CRUD operations for blog posts
- Cover image upload using Multer (local) → Cloudinary (cloud storage)
- Automatic deletion of old Cloudinary images on blog update
- Search blogs by title
- Server-side rendering with EJS
- Responsive card-based blog layout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Templating | EJS |
| File Upload | Multer |
| Cloud Storage | Cloudinary |
| Auth | JWT / Cookies |

---

## Project Structure

```
blogify/
├── middleware/
│   └── authentication.js    # JWT/cookie verification middleware
├── models/
│   ├── blog.js              # Blog schema (title, content, coverImage, cloudinaryId)
│   └── user.js              # User schema (name, email, password)
├── public/
│   └── uploads/             # Temporary local storage before Cloudinary upload
├── routes/
│   ├── blog.js              # Blog CRUD routes
│   └── user.js              # Register, login, logout routes
├── services/
│   ├── authentication.js    # Token generation and verification helpers
│   └── cloudinary.js        # Upload and delete image helpers
├── views/
│   ├── partials/
│   │   ├── head.ejs         # HTML head (meta, CSS links)
│   │   ├── nav.ejs          # Navbar partial
│   │   └── script.ejs       # Common scripts partial
│   ├── addBlog.ejs          # Create new blog page
│   ├── blog.ejs             # Single blog view
│   ├── editBlog.ejs         # Edit blog page
│   ├── home.ejs             # All blogs listing
│   ├── profile.ejs          # User profile page
│   ├── signin.ejs           # Login page
│   └── signup.ejs           # Register page
├── .env
├── .gitignore
├── connect.js               # MongoDB connection setup
├── index.js                 # App entry point
├── package.json
└── package-lock.json
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)
- Cloudinary account

### Installation

```bash
git clone https://github.com/your-username/blogify.git
cd blogify
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/blogify
JWT_SECRET=your_jwt_secret_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Run the App

```bash
# Development
npm run dev

# Production
npm start
```

Visit `http://localhost:3000`

---

## Image Upload Flow

```
User submits form with image
        ↓
Multer saves file to /public/uploads/ (temp)
        ↓
services/cloudinary.js uploads file to Cloudinary
        ↓
Cloudinary URL + public_id saved to MongoDB
        ↓
Local temp file deleted
```

On blog **update**, the old image is deleted from Cloudinary via its stored `public_id` before the new one is uploaded.

---

## Routes Overview

### User Routes (`routes/user.js`)

| Method | Route | Description |
|---|---|---|
| GET | `/user/signin` | Login page |
| POST | `/user/signin` | Authenticate user |
| GET | `/user/signup` | Register page |
| POST | `/user/signup` | Create new user |
| GET | `/user/logout` | Clear session |

### Blog Routes (`routes/blog.js`)

| Method | Route | Description |
|---|---|---|
| GET | `/` | All blogs — `home.ejs` (supports `?search=`) |
| GET | `/blog/add` | Create blog page — `addBlog.ejs` (auth required) |
| POST | `/blog/add` | Submit new blog (auth required) |
| GET | `/blog/:id` | Single blog view — `blog.ejs` |
| GET | `/blog/edit/:id` | Edit blog page — `editBlog.ejs` (author only) |
| POST | `/blog/edit/:id` | Update blog (author only) |
| POST | `/blog/delete/:id` | Delete blog (author only) |
| GET | `/user/profile` | User profile — `profile.ejs` (auth required) |

---

## License

MIT
