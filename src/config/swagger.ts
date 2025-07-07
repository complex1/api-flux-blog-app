import swaggerJSDoc from 'swagger-jsdoc';
import { Express, Request, Response } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blog API',
      version: '1.0.0',
      description: 'A comprehensive blog API with authentication, CRUD operations, likes, and comments',
      contact: {
        name: 'API Support',
        email: 'support@blogapi.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' ? 'https://api.yourdomain.com/api-flux-api' : `http://localhost:${process.env.PORT || 3000}/api-flux-api`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token in the format: Bearer <token>'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'johndoe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            full_name: { type: 'string', example: 'John Doe' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Blog: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            title: { type: 'string', example: 'My First Blog Post' },
            content: { type: 'string', example: 'This is the content of my blog post...' },
            excerpt: { type: 'string', example: 'A brief summary of the blog post' },
            author_id: { type: 'integer', example: 1 },
            is_published: { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            author_username: { type: 'string', example: 'johndoe' },
            author_full_name: { type: 'string', example: 'John Doe' },
            likes_count: { type: 'integer', example: 5 },
            comments_count: { type: 'integer', example: 3 },
            is_liked: { type: 'boolean', example: false }
          }
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            content: { type: 'string', example: 'Great blog post!' },
            user_id: { type: 'integer', example: 2 },
            blog_id: { type: 'integer', example: 1 },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            username: { type: 'string', example: 'janedoe' },
            full_name: { type: 'string', example: 'Jane Doe' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login successful' },
            data: {
              type: 'object',
              properties: {
                access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                user: { $ref: '#/components/schemas/User' }
              }
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
            error: { type: 'string' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 10 },
                total: { type: 'integer', example: 100 },
                totalPages: { type: 'integer', example: 10 }
              }
            }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            error: { type: 'string', example: 'Required field is missing' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/server.ts'] // Path to the API files
};

const specs = swaggerJSDoc(options);

export const setupSwagger = (app: Express): void => {
  const swaggerUi = require('swagger-ui-express');
  
  // Setup Swagger UI with proper middleware
  app.use('/api-flux-api/docs', swaggerUi.serve);
  app.get('/api-flux-api/docs', swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Blog API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    }
  }));
  
  // Serve swagger.json
  app.get('/api-flux-api/swagger.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export default specs;
