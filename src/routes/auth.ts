import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import database from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { User, UserResponse, AuthTokens, ApiResponse, JwtPayload } from '../types';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().max(100).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               full_name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.details[0].message
      });
      return;
    }

    const { username, email, password, full_name } = value;
    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    // Check if user already exists
    db.get(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username],
      async (err, row) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (row) {
          res.status(400).json({
            success: false,
            message: 'User with this email or username already exists'
          });
          return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        db.run(
          'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)',
          [username, email, hashedPassword, full_name || null],
          function(insertErr) {
            if (insertErr) {
              res.status(500).json({
                success: false,
                message: 'Failed to create user',
                error: insertErr.message
              });
              return;
            }

            // Get the created user
            db.get(
              'SELECT id, username, email, full_name, created_at, updated_at FROM users WHERE id = ?',
              [this.lastID],
              (selectErr, user: UserResponse) => {
                if (selectErr) {
                  res.status(500).json({
                    success: false,
                    message: 'User created but failed to retrieve details',
                    error: selectErr.message
                  });
                  return;
                }

                // Generate JWT token
                const tokenPayload: JwtPayload = {
                  userId: user.id,
                  username: user.username,
                  email: user.email
                };

                const token = jwt.sign(tokenPayload, process.env.JWT_SECRET as string, {
                  expiresIn: '24h'
                });

                const response: ApiResponse<AuthTokens> = {
                  success: true,
                  message: 'User registered successfully',
                  data: {
                    access_token: token,
                    user
                  }
                };

                res.status(201).json(response);
              }
            );
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.details[0].message
      });
      return;
    }

    const { email, password } = value;
    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user: User) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (!user) {
          res.status(400).json({
            success: false,
            message: 'Invalid email or password'
          });
          return;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          res.status(400).json({
            success: false,
            message: 'Invalid email or password'
          });
          return;
        }

        // Generate JWT token
        const tokenPayload: JwtPayload = {
          userId: user.id,
          username: user.username,
          email: user.email
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET as string, {
          expiresIn: '24h'
        });

        const userResponse: UserResponse = {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          created_at: user.created_at,
          updated_at: user.updated_at
        };

        const response: ApiResponse<AuthTokens> = {
          success: true,
          message: 'Login successful',
          data: {
            access_token: token,
            user: userResponse
          }
        };

        res.json(response);
      }
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user details
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User details retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticateToken, (req: Request, res: Response): void => {
  try {
    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    db.get(
      'SELECT id, username, email, full_name, created_at, updated_at FROM users WHERE id = ?',
      [req.user!.userId],
      (err, user: UserResponse) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (!user) {
          res.status(404).json({
            success: false,
            message: 'User not found'
          });
          return;
        }

        const response: ApiResponse<UserResponse> = {
          success: true,
          message: 'User details retrieved successfully',
          data: user
        };

        res.json(response);
      }
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
