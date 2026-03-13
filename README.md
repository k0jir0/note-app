# Note App

A full-stack note-taking application with user authentication, built with Node.js, Express, MongoDB, and EJS.

## Features

- User authentication (signup/login) with Passport.js & bcrypt
- Google OAuth sign-in with account linking by email
- CRUD operations for notes (create, read, update, delete)
- User-specific data isolation
- Input validation & XSS protection
- RESTful API with JSON responses
- Responsive UI with Bootstrap 5
- Test coverage with Mocha, Chai, and Sinon

## Tech Stack

**Backend:** Node.js, Express 5.2, MongoDB 8.10 (Mongoose), Passport.js, bcrypt  
**Frontend:** EJS 4.0, Bootstrap 5.3, Vanilla JS  
**Testing:** Mocha, Chai, Sinon, ESLint

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB Atlas account or local MongoDB
- npm

### Setup

1. **Clone & Install**
```bash
git clone https://github.com/k0jir0/note-app.git
cd note-app
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=<your-mongodb-connection-string>
SESSION_SECRET=your-strong-random-secret-32-chars-minimum
NODE_ENV=development
PORT=3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**MongoDB Setup:**
- MongoDB Atlas: Create a free cluster, copy connection string
- Local MongoDB: Use `mongodb://localhost:27017/noteApp`

3. **Run**
```bash
npm run start-dev  # Development (auto-reload)
npm start          # Production
npm test           # Run tests
npm run lint       # ESLint
```

Server: `http://localhost:3000`

4. **Create Account & Use**
- Navigate to `/auth/signup` to create an account
- Login and start creating notes
- Optional: Visit `/seed` (dev only) for sample data

## API Documentation

**Base URL:** `/api/notes`  
**Authentication:** Required for all endpoints (session cookie)

### Authentication

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/auth/signup` | POST | `email`, `password` | Redirect to `/auth/login` |
| `/auth/login` | POST | `email`, `password` | Redirect to `/` |
| `/auth/logout` | GET/POST | - | Redirect to `/auth/login` |

**Validation:**
- Email: Valid format, max 254 chars, unique
- Password: Min 8 chars, contains uppercase, lowercase, number
- Login payload: only `email` and `password` fields are accepted
- If a Google-only account attempts local email/password login, user is redirected to Google sign-in

### Notes API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/notes` | GET | Get all user's notes |
| `GET /api/notes/:id` | GET | Get single note |
| `POST /api/notes` | POST | Create note |
| `PUT /api/notes/:id` | PUT | Update note (partial updates allowed) |
| `DELETE /api/notes/:id` | DELETE | Delete note |

#### Example Requests

**Create Note:**
```json
POST /api/notes
{
  "title": "Meeting Notes",
  "content": "Discussed Q1 goals",
  "image": "https://example.com/image.jpg"
}
```

**Update Note:**
```json
PUT /api/notes/:id
{
  "title": "Updated Title"
}
```

#### Success Response Format
```json
{
  "success": true,
  "message": "Note created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Meeting Notes",
    "content": "Discussed Q1 goals",
    "image": "https://example.com/image.jpg",
    "user": "507f191e810c19729de860ea",
    "createdAt": "2026-02-17T10:30:00.000Z",
    "updatedAt": "2026-02-17T14:22:00.000Z"
  }
}
```

#### Error Response Format
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["Title is required", "Image must be a valid URL"]
}
```

#### Validation Rules

| Field | Required | Min | Max | Format |
|-------|----------|-----|-----|--------|
| `title` | Yes (create) | 3 | 200 | Non-empty string |
| `content` | No | - | 10,000 | String |
| `image` | No | - | 500 | Valid HTTP/HTTPS URL |

#### Notes Payload Hardening

- `POST /api/notes` and `PUT /api/notes/:id` only accept `title`, `content`, and `image`
- Unexpected fields are rejected with `400 Validation failed`
- Note IDs from route params are trimmed and validated before database queries

#### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success (GET, PUT, DELETE) |
| `201` | Created (POST) |
| `400` | Validation error, invalid data |
| `401` | Authentication required |
| `404` | Note not found or access denied |
| `409` | Duplicate entry (email exists) |
| `500` | Server error |

### Page Routes

| Route | Description | Auth |
|-------|-------------|------|
| `GET /` | Home (notes list) | ✅ |
| `GET /notes` | Notes list | ✅ |
| `GET /notes/new` | Create note form | ✅ |
| `GET /notes/:id` | View note | ✅ |
| `GET /notes/:id/edit` | Edit note form | ✅ |
| `GET /auth/login` | Login page | - |
| `GET /auth/signup` | Signup page | - |
| `GET /seed` | Seed database (dev only) | ✅ |

## Project Structure

```text
note-app/
├── index.js
├── package.json
├── .env.example
├── README.md
├── src/
│   ├── config/
│   │   └── passport.js
│   ├── controllers/
│   │   ├── noteApiController.js
│   │   └── noteController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Notes.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── noteApiRoutes.js
│   │   └── notePageRoutes.js
│   ├── utils/
│   │   ├── errorHandler.js
│   │   └── validation.js
│   └── views/
│       ├── pages/
│       │   ├── home.ejs
│       │   ├── login.ejs
│       │   ├── note-form.ejs
│       │   ├── note.ejs
│       │   └── signup.ejs
│       └── public/
│           ├── css/
│           │   └── styles.css
│           └── js/
│               ├── home.js
│               ├── note-form.js
│               └── notes.js
└── test/
    └── ...
```

## Development

**NPM Scripts:**
```bash
npm start          # Production
npm run start-dev  # Development (nodemon auto-reload)
npm test           # Run test suite
npm run lint       # ESLint code quality check
```

**Adding Features:**
1. Update schemas in `src/models/`
2. Add validation rules in `src/utils/validation.js`
3. Implement logic in `src/controllers/`
4. Define routes in `src/routes/`
5. Create/update EJS templates in `src/views/`
6. Write tests in `test/`

## Security

**Implemented:**
- Environment variables for secrets
- Password hashing (bcrypt, 10 salt rounds)
- Session-based authentication with Passport.js
- Safe fallback for Google-only accounts in local login flow
- Input validation & XSS sanitization
- User-specific authorization checks
- MongoDB ObjectId validation

**Production Checklist:**
- [ ] Strong `SESSION_SECRET` (32+ random chars)
- [ ] HTTPS enabled with `cookie.secure: true`
- [ ] Rate limiting (e.g., `express-rate-limit`)
- [ ] Security headers (helmet.js)
- [ ] CSRF protection
- [ ] Regular dependency updates
- [ ] MongoDB connection with TLS

## Deployment

**Required Environment Variables:**
```env
NODE_ENV=production
MONGODB_URI=<your-mongodb-connection-string>
SESSION_SECRET=strong-random-secret-min-32-chars
PORT=3000
```

**Deploy Commands:**

```bash
# Heroku
heroku create app-name
heroku config:set MONGODB_URI=... SESSION_SECRET=...
git push heroku main

# VPS with PM2
npm install pm2 -g
pm2 start index.js --name note-app
pm2 save && pm2 startup
```

**Render/Railway/Fly.io:** Deploy from GitHub, set env vars in dashboard, use `npm start`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Missing MONGODB_URI error | Create `.env` file with valid connection string |
| Authentication fails | Clear cookies, verify `SESSION_SECRET` is set |
| Tests fail | Run `npm install`, ensure Node.js v18+ |
| Port already in use | Set `PORT` env variable or kill process on port 3000 |
| Database connection fails | Check MongoDB Atlas IP whitelist or local MongoDB status |

## Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/name`)
3. Make changes & add tests
4. Run `npm test` and `npm run lint`
5. Commit with clear message
6. Push and open a pull request

**Code Standards:** Follow existing patterns, add tests for new features, update documentation

## License

ISC
