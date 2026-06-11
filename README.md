# Blogify 

A full-stack blogging platform built with Node.js and MongoDB that empowers users to create, share, and discuss content in a collaborative community. Blogify combines powerful content management with modern authentication, real-time interactions, and administrative tools.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-black?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Latest-green?style=flat-square&logo=mongodb)](https://www.mongodb.com/)

---

## 🌐 Live Demo

**[Visit Blogify Live](https://blogify-for-stories.vercel.app/)**



### Quick Links
- 🏠 [Home Page](https://blogify-for-stories.vercel.app/)
- 👤 [Sample User Profile](https://blogify-for-stories.vercel.app/user/69dbde2c8d47ffe7e0e90b6c)
- 📱 [Admin Dashboard](https://blogify-for-stories.vercel.app/admin/dashboard) (Admin access required)

---

##  Features

-  **Secure Authentication** - JWT-based authentication with HTTP-only cookies and refresh token support
-  **Rich Content Creation** - Write blogs using Markdown with real-time rendering
-  **Image Management** - Upload cover images and profile pictures to Cloudinary with automatic cleanup
-  **User Profiles** - Public profile pages showcasing user's blogs, bio, and profile information
-  **Interactive Comments** - Comment on blogs, reply to comments, edit, and delete your comments
-  **Smart Search** - Search blogs by title from the home page with pagination
-  **Email Verification** - OTP-based email verification and password reset flow
-  **Email Notifications** - Welcome emails and report notifications via Nodemailer
-  **Admin Dashboard** - Comprehensive admin panel for reviewing and managing content
-  **Role-Based Access Control** - Owner-only admin promotion/demotion system
-  **Content Reporting** - Report inappropriate blogs and comments to administrators
-  **Responsive Design** - Mobile-friendly interface built with EJS templates

---

##  Screenshots

### Home Page with Blog Listing & Search
![Home Page with Blog Listing & Search](./public/screenshots/image1.png)

### Blog Reading View
![Blog Detail Page](./public/screenshots/image2.png)
![Blog Comments Section](./public/screenshots/image3.png)
![Blog Markdown Rendering](./public/screenshots/image4.png)

### User Dashboard & Account Settings
![User Profile Page](./public/screenshots/image5.png)
![Account Settings](./public/screenshots/image6.png)
![User Dashboard](./public/screenshots/image7.png)

### Admin Dashboard
![Admin Dashboard Overview](./public/screenshots/image8.png)
![Admin Blog Management](./public/screenshots/image9.png)

---

##  Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Runtime** | Node.js | JavaScript runtime environment |
| **Server Framework** | Express.js 5.x | REST API & Web server |
| **Database** | MongoDB | NoSQL database |
| **ODM** | Mongoose 9.x | MongoDB object modeling |
| **Template Engine** | EJS | Server-side rendering |
| **Authentication** | JWT, bcrypt | Secure user authentication |
| **File Upload** | Multer | Handling file uploads |
| **Image Storage** | Cloudinary | Cloud-based media management |
| **Email Service** | Nodemailer | Email delivery (Gmail SMTP) |
| **Content Parsing** | Marked | Markdown to HTML conversion |
| **Security** | Cookie Parser, bcrypt | Session & password security |
| **OTP Generation** | Speakeasy | Two-factor authentication |
| **Validation** | Validator | Input validation |

---

## 🏗️ Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser["Web Browser"]
    end
    
    subgraph Server["Express Server"]
        Routes["Routes"]
        Auth["Authentication<br/>Middleware"]
        Authz["Authorization<br/>Middleware"]
        Controllers["Route Handlers"]
    end
    
    subgraph Services["Business Logic Layer"]
        AuthSvc["Auth Service"]
        CloudinarySvc["Cloudinary<br/>Service"]
        EmailSvc["Email<br/>Service"]
        OTPSvc["OTP<br/>Service"]
    end
    
    subgraph Data["Data Layer"]
        MongoDB[("MongoDB<br/>Database")]
        Mongoose["Mongoose<br/>ODM"]
    end
    
    subgraph External["External Services"]
        Cloudinary["☁️ Cloudinary<br/>Image Hosting"]
        Gmail["📧 Gmail<br/>SMTP"]
    end
    
    subgraph View["View Layer"]
        EJS["EJS Templates"]
    end
    
    Browser -->|HTTP Request| Routes
    Routes --> Auth
    Auth --> Authz
    Authz --> Controllers
    
    Controllers --> AuthSvc
    Controllers --> CloudinarySvc
    Controllers --> EmailSvc
    Controllers --> OTPSvc
    
    AuthSvc --> Mongoose
    CloudinarySvc --> Cloudinary
    EmailSvc --> Gmail
    OTPSvc --> AuthSvc
    
    Mongoose --> MongoDB
    
    Controllers --> EJS
    EJS -->|HTML Response| Browser
```

### Architecture Overview

**Request Flow:**
1. User request arrives at Express server
2. Routes direct request to appropriate handler
3. Authentication middleware validates JWT cookie
4. Authorization middleware checks user role/permissions
5. Controllers execute business logic via services
6. Services interact with MongoDB via Mongoose
7. External services (Cloudinary, Gmail) are called as needed
8. EJS templates render response
9. HTML is sent back to client

**Layer Responsibilities:**
- **Presentation Layer**: EJS templates for server-side rendering
- **Route Layer**: Express routes with HTTP method mapping
- **Middleware Layer**: Authentication and authorization checks
- **Service Layer**: Business logic for auth, email, uploads, and OTP
- **Data Layer**: Mongoose ODM for MongoDB interactions
- **External Layer**: Cloudinary for images, Gmail for emails

---

##  Installation

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- Cloudinary account (for image hosting)
- Gmail account (for email notifications)

### Step 1: Clone the Repository
```bash
git clone https://github.com/yourusername/blogify.git
cd blogify
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Create Environment File
Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

### Step 4: Configure Environment Variables
Edit `.env` with your credentials (see [Environment Variables](#-environment-variables) section below)

### Step 5: Start the Application

**Development Mode** (with auto-reload):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

The application will start on `http://localhost:8000` (or your configured PORT)

---

##  Environment Variables

Create a `.env` file in the root directory with the following variables:

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `MONGODB_URL` | string | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/blogify` |
| `PORT` | number | Server port | `8000` |
| `NODE_ENV` | string | Environment mode | `development` or `production` |
| `JWT_SECRET` | string | JWT signing secret | `your-secret-key-here` |
| `JWT_EXPIRY` | string | Access token expiry time | `7d` |
| `REFRESH_TOKEN_SECRET` | string | Refresh token secret | `your-refresh-secret` |
| `REFRESH_TOKEN_EXPIRY` | string | Refresh token expiry | `30d` |
| `CLOUDINARY_NAME` | string | Cloudinary account name | `your-cloudinary-name` |
| `CLOUDINARY_API_KEY` | string | Cloudinary API key | `your-api-key` |
| `CLOUDINARY_API_SECRET` | string | Cloudinary API secret | `your-api-secret` |
| `EMAIL_USER` | string | Gmail address | `your-email@gmail.com` |
| `EMAIL_PASSWORD` | string | Gmail app password | `your-app-password` |
| `OTP_SECRET` | string | Secret for OTP generation | `your-otp-secret` |

> **Note**: Use [Gmail App Passwords](https://support.google.com/accounts/answer/185833) for the EMAIL_PASSWORD field.

---

##  Usage

### Running the Application

```bash
npm run dev    # Development with nodemon
npm start      # Production mode
```

Visit `http://localhost:8000` in your browser to access Blogify.

### User Workflows

#### 1. **Sign Up**
- Navigate to `/signup`
- Enter email, password, and full name
- Verify your email via OTP sent to your inbox
- Create your account

#### 2. **Create a Blog**
- Log in and click "Create Blog"
- Write your blog using Markdown syntax
- Upload a cover image
- Publish your blog

#### 3. **Read & Interact**
- Browse blogs on the home page
- Click on a blog to read full content (Markdown is automatically rendered)
- Leave comments and replies
- Search blogs by title

#### 4. **Manage Profile**
- Update your profile information
- Add a bio and profile picture
- View all your published blogs

#### 5. **Admin Functions** (Admin users only)
- Access admin dashboard
- Review and delete reported content
- Promote/demote other admins

---

##  Project Structure

```
blogify/
├── index.js                    # Express app entry point & route setup
├── connect.js                  # MongoDB connection configuration
├── package.json                # Project dependencies
├── .env.example                # Environment variables template
├── README.md                   # Project documentation
│
├── middleware/                 # Express middleware functions
│   ├── authentication.js        # JWT validation & auth cookie parsing
│   └── authorization.js         # Role-based access control (RBAC)
│
├── models/                     # Mongoose schemas
│   ├── user.js                 # User schema with auth methods
│   ├── blog.js                 # Blog post schema
│   └── comment.js              # Comment & reply schema
│
├── routes/                     # API route handlers
│   ├── user.js                 # User authentication & profile routes
│   ├── blog.js                 # Blog CRUD & comment routes
│   ├── admin.js                # Admin dashboard routes
│   └── emailVerify.js          # Email verification routes
│
├── services/                   # Business logic & external integrations
│   ├── authentication.js       # JWT token generation
│   ├── cloudinary.js           # Image upload/deletion to Cloudinary
│   ├── nodeMailer.js           # Email sending logic
│   ├── emailConfirmationToken.js # Email verification token generation
│   └── otpGenerator.js         # OTP generation for email verification
│
├── views/                      # EJS template files
│   ├── home.ejs                # Blog listing page with search & pagination
│   ├── blog.ejs                # Individual blog display with comments
│   ├── addBlog.ejs             # Blog creation form
│   ├── editBlog.ejs            # Blog editing form
│   ├── profile.ejs             # User profile page
│   ├── signin.ejs              # Login form
│   ├── signup.ejs              # Registration form
│   ├── accountSetting.ejs      # User account settings
│   ├── admin.ejs               # Admin dashboard
│   ├── forgotPassword.ejs      # Password reset request
│   ├── resetPassword.ejs       # New password form
│   ├── verifyOtp.ejs           # OTP verification form
│   ├── verifyNotice.ejs        # Email verification notice
│   ├── emailVerified.ejs       # Email verified confirmation
│   └── partials/               # Reusable template components
│       ├── head.ejs            # HTML head section (styles, meta)
│       ├── nav.ejs             # Navigation bar
│       └── script.ejs          # JavaScript includes & footer scripts
│
└── public/                     # Static assets
    └── site.webmanifest        # PWA manifest
```

---

##  API Endpoints

### Authentication Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|----------------|
| GET | `/user/signin` | Signin page | ❌ |
| POST | `/user/signin` | Sign in user | ❌ |
| GET | `/user/signup` | Signup page | ❌ |
| POST | `/user/signup` | Create new account | ❌ |
| GET | `/user/logout` | Logout user | ✅ |
| GET | `/user/forgot-password` | Password reset page | ❌ |
| POST | `/user/forgot-password` | Send password reset email | ❌ |
| POST | `/user/reset-password` | Reset password with token | ❌ |
| GET | `/user/:userId` | View user profile | ❌ |
| GET | `/user/account-settings` | Account settings page | ✅ |
| POST | `/user/account-settings` | Update account settings | ✅ |

### Blog Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|----------------|
| GET | `/blog` | Get all blogs with pagination | ❌ |
| GET | `/blog/add-new` | Add blog form | ✅ |
| POST | `/blog` | Create new blog | ✅ |
| GET | `/blog/:id` | View individual blog | ❌ |
| GET | `/blog/:id/edit` | Edit blog form | ✅ |
| POST | `/blog/:id` | Update blog | ✅ |
| DELETE | `/blog/:id` | Delete blog | ✅ |
| POST | `/blog/:id/comment` | Add comment to blog | ✅ |
| DELETE | `/blog/:id/comment/:commentId` | Delete comment | ✅ |
| POST | `/blog/:id/report` | Report blog content | ✅ |

### Admin Routes

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|----------------|------|
| GET | `/admin` | Admin dashboard | ✅ | Admin |
| DELETE | `/admin/blog/:blogId` | Delete blog (admin) | ✅ | Admin |
| POST | `/admin/promote/:userId` | Promote user to admin | ✅ | Owner |
| POST | `/admin/demote/:userId` | Demote admin to user | ✅ | Owner |

### Email Verification Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|----------------|
| GET | `/emailVerify/verify-otp` | OTP verification page | ❌ |
| POST | `/emailVerify/verify-otp` | Verify email with OTP | ❌ |
| GET | `/emailVerify/resend-otp` | Resend OTP | ❌ |

---

##  Authentication Flow

### Sign Up Process
```
User Registration → Email OTP Sent → OTP Verification → Account Created
```

### Sign In Process
```
Email & Password → JWT Generated → Access Token in HTTP-only Cookie → Logged In
```

### Password Reset
```
Forgot Password → Reset Link Sent → Verify OTP → New Password → Password Changed
```

---

##  Future Improvements

- [ ] **Social Features** - Follow users, like blogs, and user feeds
- [ ] **Advanced Search** - Full-text search with filters (date range, author, category)
- [ ] **Blog Categories & Tags** - Organize blogs by topic
- [ ] **Rich Text Editor** - WYSIWYG editor instead of plain Markdown
- [ ] **Notification System** - Real-time notifications for comments and interactions
- [ ] **Blog Publishing Schedule** - Schedule blogs for future publication
- [ ] **Reading Analytics** - Track blog views, engagement metrics
- [ ] **API Documentation** - Swagger/OpenAPI specification
- [ ] **Rate Limiting** - Prevent spam and abuse
- [ ] **Two-Factor Authentication** - Enhanced account security
- [ ] **Blog Versioning** - Track and restore previous blog versions
- [ ] **Social Sharing** - Share blogs on social media platforms
- [ ] **SEO Optimization** - Meta tags, sitemaps, structured data

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/blogify.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Commit your changes**
   ```bash
   git commit -m "Add some amazing feature"
   ```

4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **Open a Pull Request**
   - Describe your changes clearly
   - Reference any related issues
   - Ensure tests pass and code follows style guide

### Code Style Guidelines
- Use consistent indentation (2 spaces)
- Write meaningful commit messages
- Add comments for complex logic
- Follow MVC architecture patterns
- Validate all user inputs

---

##  Author

**Blogify Creator**

Connect with me on:

-  **GitHub**: [@sisodiaumang](https://github.com/sisodiaumang/)
-  **LinkedIn**: [sisodiaumang](www.linkedin.com/in/sisodiaumang)
-  **Email**: sisodiaumang6@gmail.com

---

##  Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Mongoose](https://mongoosejs.com/) - ODM for MongoDB
- [Cloudinary](https://cloudinary.com/) - Media management
- [Nodemailer](https://nodemailer.com/) - Email service
- [Marked](https://marked.js.org/) - Markdown parser
- Open-source community for libraries and tools

---

##  Support

If you encounter any issues or have questions:

1. Check the [existing issues](https://github.com/sisodiaumang/blogify/issues)
2. Create a [new issue](https://github.com/sisodiaumang/blogify/issues/new) with detailed description
3. Contact via email or social media

---

<div align="center">

⭐ **Found this helpful? Please consider giving a star!** ⭐

</div>
