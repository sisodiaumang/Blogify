# Blogify

Blogify is a full-stack blogging application built with Node.js, Express, MongoDB, Mongoose, and EJS. It lets users publish markdown-based posts, upload cover images, manage profiles, comment on posts, report content, and use role-based admin tools.

## Features

- User signup, signin, logout, and JWT cookie authentication
- Access and refresh token support
- Password reset flow with email OTP verification
- Welcome emails and report notification emails through Nodemailer
- Create, read, update, and delete blog posts
- Markdown rendering for blog content with `marked`
- Cover image and profile image uploads to Cloudinary
- Automatic Cloudinary cleanup when images, posts, or accounts are deleted
- Public user profile pages with each user's posts
- Account settings for profile name, bio, and profile image
- Blog comments, comment editing, comment deletion, and comment replies
- Blog and comment reporting to admins/owners
- Search blogs by title from the home page
- Admin dashboard for reviewing/deleting blogs
- Owner-only role management for promoting or demoting admins

## Tech Stack

| Area | Tools |
| --- | --- |
| Runtime | Node.js |
| Server | Express.js |
| Database | MongoDB, Mongoose |
| Views | EJS |
| Authentication | JSON Web Tokens, HTTP-only cookies |
| Password hashing | Node.js crypto HMAC |
| Uploads | Multer memory storage |
| Media storage | Cloudinary |
| Email | Nodemailer with Gmail |
| Markdown | marked |

## Project Structure

```text
BlogApplication/
|-- index.js                 # Express app entry point
|-- connect.js               # MongoDB connection helper
|-- package.json
|-- middleware/
|   |-- authentication.js     # Reads and validates auth cookies
|   `-- authorization.js      # Role-based access control
|-- models/
|   |-- blog.js               # Blog schema
|   |-- comment.js            # Comment and reply schema
|   `-- user.js               # User schema, password hashing, token creation
|-- routes/
|   |-- admin.js              # Admin dashboard and owner role actions
|   |-- blog.js               # Blog, comment, reply, and report routes
|   `-- user.js               # Auth, profile, settings, and password reset routes
|-- services/
|   |-- authentication.js     # JWT helper functions
|   |-- cloudinary.js         # Cloudinary upload/delete helpers
|   |-- nodeMailer.js         # OTP, welcome, and report emails
|   `-- otpGenerator.js
|-- public/                   # Static assets and favicons
|-- views/                    # EJS pages
`-- views/partials/           # Shared head, nav, and scripts
```

## Getting Started

### Prerequisites

- Node.js
- MongoDB database, local or Atlas
- Cloudinary account
- Gmail account with an app password for Nodemailer

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=8000
MONGODB_URL=mongodb://127.0.0.1:27017/blogify

ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

EMAIL=your_gmail_address
EMAIL_PASS=your_gmail_app_password

NODE_ENV=development
```

### Run Locally

```bash
npm run dev
```

For a normal Node start:

```bash
npm start
```

The app runs on `http://localhost:8000` by default, or the value provided in `PORT`.

## Main Routes

### Public

| Method | Route | Description |
| --- | --- | --- |
| GET | `/` | Home page with all blogs and optional `?search=` query |
| GET | `/blog/:id` | Single blog page with rendered markdown and comments |
| GET | `/user/signin` | Signin page |
| GET | `/user/signup` | Signup page |
| GET | `/user/:id` | Public user profile page |

### User

| Method | Route | Description |
| --- | --- | --- |
| POST | `/user/signin` | Authenticate user and set auth cookies |
| POST | `/user/signup` | Create account and send welcome email |
| GET | `/user/logout` | Clear auth cookies |
| GET | `/user/forgot-password` | Password reset request page |
| POST | `/user/forgot-password` | Generate and email OTP |
| POST | `/user/verifyOtp` | Verify OTP |
| GET | `/user/resetPassword/:otp` | Reset password page |
| POST | `/user/resetPassword/:otp` | Save new password |
| GET | `/user/settings` | Account settings page |
| PATCH | `/user/update-profile` | Update profile details and image |
| DELETE | `/user/delete-account` | Delete account, posts, and related Cloudinary media |

### Blog and Comments

| Method | Route | Description |
| --- | --- | --- |
| GET | `/blog/add-new` | New blog form |
| POST | `/blog` | Create blog post |
| GET | `/blog/edit/:id` | Edit blog form |
| PATCH | `/blog/edit/:id` | Update blog post |
| DELETE | `/blog/delete/:id` | Delete blog post |
| POST | `/blog/comment/:id` | Add comment to a blog |
| POST | `/blog/comment/edit/:id` | Edit own comment |
| DELETE | `/blog/comment/delete/:id` | Delete own comment or delete as blog author |
| POST | `/blog/comment/reply/:commentId` | Reply to a comment |
| POST | `/blog/report` | Report a blog or comment |

### Admin

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| GET | `/admin/dashboard` | ADMIN, OWNER | View blogs, optionally search by blog ID |
| POST | `/admin/blog/delete/:id` | ADMIN, OWNER | Delete any blog |
| POST | `/admin/assign-role` | OWNER | Promote or demote an admin by email |

## Notes

- Blog content is stored as markdown and rendered on the server with `marked`.
- File uploads use Multer memory storage, then stream directly to Cloudinary.
- Auth state is stored in HTTP-only cookies named `accessToken` and `refreshToken`.
- Role-based admin access uses the `role` field on users: `USER`, `ADMIN`, or `OWNER`.

## Scripts

```bash
npm run dev   # Start with nodemon
npm start     # Start with node
```

## License

This project is currently configured with the ISC license in `package.json`.
