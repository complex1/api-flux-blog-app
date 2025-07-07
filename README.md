# Blog API

A comprehensive TypeScript Node.js blog application with SQLite database, authentication, and OpenAPI 3.0 documentation.

## Features

### Authentication
- ✅ User registration
- ✅ User login with JWT tokens
- ✅ Get current user details
- ✅ Token-based authentication middleware

### Blog Management
- ✅ Create blog posts
- ✅ Get all published blogs (public)
- ✅ Get user's own blogs
- ✅ Get specific blog by ID
- ✅ Update blog posts (author only)
- ✅ Delete blog posts (author only)
- ✅ Pagination support

### Social Features
- ✅ Like/unlike blog posts
- ✅ Comment on blog posts
- ✅ Get comments for a blog post
- ✅ Comment pagination

### Technical Features
- ✅ TypeScript implementation
- ✅ SQLite database with foreign key constraints
- ✅ OpenAPI 3.0 documentation with Swagger UI
- ✅ Input validation with Joi
- ✅ Password hashing with bcrypt
- ✅ Rate limiting
- ✅ CORS support
- ✅ Security headers with Helmet
- ✅ Comprehensive error handling
- ✅ Graceful shutdown handling

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
NODE_ENV=development
DB_PATH=./database.sqlite
```

## Development

Start the development server:
```bash
npm run dev
```

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-flux-api/docs
- **OpenAPI JSON**: http://localhost:3000/api-flux-api/swagger.json
- **Health Check**: http://localhost:3000/api-flux-api/health

## Web Interface

The application also includes a web interface accessible at:
- **Home Page**: http://localhost:3000/api-flux-blog/
- **Login**: http://localhost:3000/api-flux-blog/login
- **Register**: http://localhost:3000/api-flux-blog/register
- **Dashboard**: http://localhost:3000/api-flux-blog/dashboard

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api-flux-api/auth/register` | Register a new user | No |
| POST | `/api-flux-api/auth/login` | Login user | No |
| GET | `/api-flux-api/auth/me` | Get current user details | Yes |

### Blogs
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api-flux-api/blogs` | Create a blog post | Yes |
| GET | `/api-flux-api/blogs` | Get all published blogs | No |
| GET | `/api-flux-api/blogs/my` | Get current user's blogs | Yes |
| GET | `/api-flux-api/blogs/:id` | Get specific blog | No |
| PUT | `/api-flux-api/blogs/:id` | Update blog (author only) | Yes |
| DELETE | `/api-flux-api/blogs/:id` | Delete blog (author only) | Yes |
| POST | `/api-flux-api/blogs/:id/like` | Like/unlike a blog | Yes |
| POST | `/api-flux-api/blogs/:id/comments` | Add comment to blog | Yes |
| GET | `/api-flux-api/blogs/:id/comments` | Get blog comments | No |

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Blogs Table
```sql
CREATE TABLE blogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id INTEGER NOT NULL,
  is_published BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### Likes Table
```sql
CREATE TABLE likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  blog_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blog_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
);
```

### Comments Table
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  blog_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
);
```

## Usage Examples

### 1. Register a new user
```bash
curl -X POST http://localhost:3000/api-flux-api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "full_name": "John Doe"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api-flux-api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### 3. Create a blog post
```bash
curl -X POST http://localhost:3000/api-flux-api/blogs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "My First Blog Post",
    "content": "This is the content of my blog post...",
    "excerpt": "A brief summary",
    "is_published": true
  }'
```

### 4. Get all blogs
```bash
curl http://localhost:3000/api-flux-api/blogs?page=1&limit=10
```

### 5. Like a blog post
```bash
curl -X POST http://localhost:3000/api-flux-api/blogs/1/like \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6. Add a comment
```bash
curl -X POST http://localhost:3000/api-flux-api/blogs/1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "content": "Great blog post!"
  }'
```

## Response Format

All API responses follow this consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: All inputs are validated using Joi schemas
- **SQL Injection Protection**: Using parameterized queries
- **CORS**: Configurable cross-origin resource sharing
- **Security Headers**: Added via Helmet middleware

## Error Handling

The API includes comprehensive error handling:
- Input validation errors
- Database connection errors
- Authentication errors
- Authorization errors
- Resource not found errors
- Internal server errors

## Project Structure

```
src/
├── config/
│   ├── database.ts       # Database configuration and connection
│   └── swagger.ts        # OpenAPI/Swagger configuration
├── middleware/
│   └── auth.ts          # Authentication middleware
├── routes/
│   ├── auth.ts          # Authentication routes
│   └── blogs.ts         # Blog routes
├── types/
│   └── index.ts         # TypeScript type definitions
└── server.ts            # Main application entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `JWT_SECRET` | JWT signing secret | (required) |
| `NODE_ENV` | Environment mode | development |
| `DB_PATH` | SQLite database path | ./database.sqlite |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
# api-flux-blog-app
