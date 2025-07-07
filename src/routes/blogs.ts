import { Router, Request, Response } from 'express';
import Joi from 'joi';
import database from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Blog, BlogWithAuthor, Comment, CommentWithUser, ApiResponse, PaginatedResponse } from '../types';

const router = Router();

// Validation schemas
const createBlogSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  content: Joi.string().min(1).required(),
  excerpt: Joi.string().max(500).optional(),
  is_published: Joi.boolean().default(true)
});

const updateBlogSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  content: Joi.string().min(1).optional(),
  excerpt: Joi.string().max(500).optional(),
  is_published: Joi.boolean().optional()
});

const commentSchema = Joi.object({
  content: Joi.string().min(1).required()
});

/**
 * @swagger
 * /api/blogs:
 *   post:
 *     summary: Create a new blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 example: My First Blog Post
 *               content:
 *                 type: string
 *                 example: This is the content of my blog post...
 *               excerpt:
 *                 type: string
 *                 example: A brief summary
 *               is_published:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Blog created successfully
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
 *                   example: Blog created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Blog'
 */
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = createBlogSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.details[0].message
      });
      return;
    }

    const { title, content, excerpt, is_published } = value;
    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    db.run(
      'INSERT INTO blogs (title, content, excerpt, author_id, is_published) VALUES (?, ?, ?, ?, ?)',
      [title, content, excerpt || null, req.user!.userId, is_published],
      function(err) {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Failed to create blog',
            error: err.message
          });
          return;
        }

        // Get the created blog
        db.get(
          `SELECT b.*, u.username as author_username, u.full_name as author_full_name,
           (SELECT COUNT(*) FROM likes WHERE blog_id = b.id) as likes_count,
           (SELECT COUNT(*) FROM comments WHERE blog_id = b.id) as comments_count
           FROM blogs b 
           JOIN users u ON b.author_id = u.id 
           WHERE b.id = ?`,
          [this.lastID],
          (selectErr, blog: BlogWithAuthor) => {
            if (selectErr) {
              res.status(500).json({
                success: false,
                message: 'Blog created but failed to retrieve details',
                error: selectErr.message
              });
              return;
            }

            const response: ApiResponse<BlogWithAuthor> = {
              success: true,
              message: 'Blog created successfully',
              data: blog
            };

            res.status(201).json(response);
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
 * /api/blogs:
 *   get:
 *     summary: Get all published blogs (public)
 *     tags: [Blogs]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of blogs per page
 *     responses:
 *       200:
 *         description: Blogs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    // Get total count
    db.get(
      'SELECT COUNT(*) as total FROM blogs WHERE is_published = 1',
      [],
      (countErr, countRow: { total: number }) => {
        if (countErr) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: countErr.message
          });
          return;
        }

        const total = countRow.total;
        const totalPages = Math.ceil(total / limit);

        // Get blogs
        db.all(
          `SELECT b.*, u.username as author_username, u.full_name as author_full_name,
           (SELECT COUNT(*) FROM likes WHERE blog_id = b.id) as likes_count,
           (SELECT COUNT(*) FROM comments WHERE blog_id = b.id) as comments_count
           ${req.user ? `, (SELECT COUNT(*) FROM likes WHERE blog_id = b.id AND user_id = ?) as is_liked` : ''}
           FROM blogs b 
           JOIN users u ON b.author_id = u.id 
           WHERE b.is_published = 1
           ORDER BY b.created_at DESC
           LIMIT ? OFFSET ?`,
          req.user ? [req.user.userId, limit, offset] : [limit, offset],
          (err, blogs: BlogWithAuthor[]) => {
            if (err) {
              res.status(500).json({
                success: false,
                message: 'Database error',
                error: err.message
              });
              return;
            }

            // Convert is_liked from number to boolean if user is authenticated
            if (req.user) {
              blogs = blogs.map(blog => ({
                ...blog,
                is_liked: (blog.is_liked as any) === 1
              }));
            }

            const response: PaginatedResponse<BlogWithAuthor> = {
              success: true,
              data: blogs,
              pagination: {
                page,
                limit,
                total,
                totalPages
              }
            };

            res.json(response);
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
 * /api/blogs/my:
 *   get:
 *     summary: Get current user's blogs
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of blogs per page
 *     responses:
 *       200:
 *         description: User's blogs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get('/my', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    // Get total count
    db.get(
      'SELECT COUNT(*) as total FROM blogs WHERE author_id = ?',
      [req.user!.userId],
      (countErr, countRow: { total: number }) => {
        if (countErr) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: countErr.message
          });
          return;
        }

        const total = countRow.total;
        const totalPages = Math.ceil(total / limit);

        // Get blogs
        db.all(
          `SELECT b.*, u.username as author_username, u.full_name as author_full_name,
           (SELECT COUNT(*) FROM likes WHERE blog_id = b.id) as likes_count,
           (SELECT COUNT(*) FROM comments WHERE blog_id = b.id) as comments_count
           FROM blogs b 
           JOIN users u ON b.author_id = u.id 
           WHERE b.author_id = ?
           ORDER BY b.created_at DESC
           LIMIT ? OFFSET ?`,
          [req.user!.userId, limit, offset],
          (err, blogs: BlogWithAuthor[]) => {
            if (err) {
              res.status(500).json({
                success: false,
                message: 'Database error',
                error: err.message
              });
              return;
            }

            const response: PaginatedResponse<BlogWithAuthor> = {
              success: true,
              data: blogs,
              pagination: {
                page,
                limit,
                total,
                totalPages
              }
            };

            res.json(response);
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
 * /api/blogs/{id}:
 *   get:
 *     summary: Get a specific blog by ID
 *     tags: [Blogs]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Blog ID
 *     responses:
 *       200:
 *         description: Blog retrieved successfully
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
 *                   example: Blog retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Blog'
 *       404:
 *         description: Blog not found
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const blogId = parseInt(req.params.id);

    if (isNaN(blogId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
      return;
    }

    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    db.get(
      `SELECT b.*, u.username as author_username, u.full_name as author_full_name,
       (SELECT COUNT(*) FROM likes WHERE blog_id = b.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE blog_id = b.id) as comments_count
       ${req.user ? `, (SELECT COUNT(*) FROM likes WHERE blog_id = b.id AND user_id = ?) as is_liked` : ''}
       FROM blogs b 
       JOIN users u ON b.author_id = u.id 
       WHERE b.id = ? AND (b.is_published = 1 OR b.author_id = ?)`,
      req.user ? [req.user.userId, blogId, req.user.userId] : [blogId, 0],
      (err, blog: BlogWithAuthor) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (!blog) {
          res.status(404).json({
            success: false,
            message: 'Blog not found'
          });
          return;
        }

        // Convert is_liked from number to boolean if user is authenticated
        if (req.user && blog.is_liked !== undefined) {
          blog.is_liked = (blog.is_liked as any) === 1;
        }

        const response: ApiResponse<BlogWithAuthor> = {
          success: true,
          message: 'Blog retrieved successfully',
          data: blog
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
 * /api/blogs/{id}:
 *   put:
 *     summary: Update a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Blog ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Blog Title
 *               content:
 *                 type: string
 *                 example: Updated content...
 *               excerpt:
 *                 type: string
 *                 example: Updated excerpt
 *               is_published:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Blog updated successfully
 *       403:
 *         description: Not authorized to update this blog
 *       404:
 *         description: Blog not found
 */
router.put('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const blogId = parseInt(req.params.id);

    if (isNaN(blogId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
      return;
    }

    const { error, value } = updateBlogSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.details[0].message
      });
      return;
    }

    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    // Check if blog exists and user is the author
    db.get(
      'SELECT * FROM blogs WHERE id = ? AND author_id = ?',
      [blogId, req.user!.userId],
      (err, blog: Blog) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (!blog) {
          res.status(404).json({
            success: false,
            message: 'Blog not found or you are not authorized to update it'
          });
          return;
        }

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (value.title !== undefined) {
          updates.push('title = ?');
          params.push(value.title);
        }
        if (value.content !== undefined) {
          updates.push('content = ?');
          params.push(value.content);
        }
        if (value.excerpt !== undefined) {
          updates.push('excerpt = ?');
          params.push(value.excerpt);
        }
        if (value.is_published !== undefined) {
          updates.push('is_published = ?');
          params.push(value.is_published);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(blogId);

        if (updates.length === 1) {
          res.status(400).json({
            success: false,
            message: 'No fields to update'
          });
          return;
        }

        const updateQuery = `UPDATE blogs SET ${updates.join(', ')} WHERE id = ?`;

        db.run(updateQuery, params, function(updateErr) {
          if (updateErr) {
            res.status(500).json({
              success: false,
              message: 'Failed to update blog',
              error: updateErr.message
            });
            return;
          }

          // Get updated blog
          db.get(
            `SELECT b.*, u.username as author_username, u.full_name as author_full_name,
             (SELECT COUNT(*) FROM likes WHERE blog_id = b.id) as likes_count,
             (SELECT COUNT(*) FROM comments WHERE blog_id = b.id) as comments_count
             FROM blogs b 
             JOIN users u ON b.author_id = u.id 
             WHERE b.id = ?`,
            [blogId],
            (selectErr, updatedBlog: BlogWithAuthor) => {
              if (selectErr) {
                res.status(500).json({
                  success: false,
                  message: 'Blog updated but failed to retrieve details',
                  error: selectErr.message
                });
                return;
              }

              const response: ApiResponse<BlogWithAuthor> = {
                success: true,
                message: 'Blog updated successfully',
                data: updatedBlog
              };

              res.json(response);
            }
          );
        });
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
 * /api/blogs/{id}:
 *   delete:
 *     summary: Delete a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Blog ID
 *     responses:
 *       200:
 *         description: Blog deleted successfully
 *       403:
 *         description: Not authorized to delete this blog
 *       404:
 *         description: Blog not found
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const blogId = parseInt(req.params.id);

    if (isNaN(blogId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
      return;
    }

    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    // Check if blog exists and user is the author
    db.get(
      'SELECT * FROM blogs WHERE id = ? AND author_id = ?',
      [blogId, req.user!.userId],
      (err, blog: Blog) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (!blog) {
          res.status(404).json({
            success: false,
            message: 'Blog not found or you are not authorized to delete it'
          });
          return;
        }

        // Delete the blog (cascade will handle likes and comments)
        db.run(
          'DELETE FROM blogs WHERE id = ?',
          [blogId],
          function(deleteErr) {
            if (deleteErr) {
              res.status(500).json({
                success: false,
                message: 'Failed to delete blog',
                error: deleteErr.message
              });
              return;
            }

            const response: ApiResponse = {
              success: true,
              message: 'Blog deleted successfully'
            };

            res.json(response);
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
 * /api/blogs/{id}/like:
 *   post:
 *     summary: Like or unlike a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Blog ID
 *     responses:
 *       200:
 *         description: Like status updated successfully
 *       404:
 *         description: Blog not found
 */
router.post('/:id/like', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const blogId = parseInt(req.params.id);

    if (isNaN(blogId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
      return;
    }

    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    // Check if blog exists
    db.get(
      'SELECT id FROM blogs WHERE id = ? AND is_published = 1',
      [blogId],
      (err, blog) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (!blog) {
          res.status(404).json({
            success: false,
            message: 'Blog not found'
          });
          return;
        }

        // Check if user already liked this blog
        db.get(
          'SELECT id FROM likes WHERE user_id = ? AND blog_id = ?',
          [req.user!.userId, blogId],
          (likeErr, existingLike) => {
            if (likeErr) {
              res.status(500).json({
                success: false,
                message: 'Database error',
                error: likeErr.message
              });
              return;
            }

            if (existingLike) {
              // Unlike the blog
              db.run(
                'DELETE FROM likes WHERE user_id = ? AND blog_id = ?',
                [req.user!.userId, blogId],
                function(deleteErr) {
                  if (deleteErr) {
                    res.status(500).json({
                      success: false,
                      message: 'Failed to unlike blog',
                      error: deleteErr.message
                    });
                    return;
                  }

                  const response: ApiResponse = {
                    success: true,
                    message: 'Blog unliked successfully'
                  };

                  res.json(response);
                }
              );
            } else {
              // Like the blog
              db.run(
                'INSERT INTO likes (user_id, blog_id) VALUES (?, ?)',
                [req.user!.userId, blogId],
                function(insertErr) {
                  if (insertErr) {
                    res.status(500).json({
                      success: false,
                      message: 'Failed to like blog',
                      error: insertErr.message
                    });
                    return;
                  }

                  const response: ApiResponse = {
                    success: true,
                    message: 'Blog liked successfully'
                  };

                  res.json(response);
                }
              );
            }
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
 * /api/blogs/{id}/comments:
 *   post:
 *     summary: Add a comment to a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Blog ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: Great blog post!
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       404:
 *         description: Blog not found
 */
router.post('/:id/comments', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const blogId = parseInt(req.params.id);

    if (isNaN(blogId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
      return;
    }

    const { error, value } = commentSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.details[0].message
      });
      return;
    }

    const { content } = value;
    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    // Check if blog exists
    db.get(
      'SELECT id FROM blogs WHERE id = ? AND is_published = 1',
      [blogId],
      (err, blog) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (!blog) {
          res.status(404).json({
            success: false,
            message: 'Blog not found'
          });
          return;
        }

        // Add comment
        db.run(
          'INSERT INTO comments (content, user_id, blog_id) VALUES (?, ?, ?)',
          [content, req.user!.userId, blogId],
          function(insertErr) {
            if (insertErr) {
              res.status(500).json({
                success: false,
                message: 'Failed to add comment',
                error: insertErr.message
              });
              return;
            }

            // Get the created comment with user details
            db.get(
              `SELECT c.*, u.username, u.full_name
               FROM comments c 
               JOIN users u ON c.user_id = u.id 
               WHERE c.id = ?`,
              [this.lastID],
              (selectErr, comment: CommentWithUser) => {
                if (selectErr) {
                  res.status(500).json({
                    success: false,
                    message: 'Comment added but failed to retrieve details',
                    error: selectErr.message
                  });
                  return;
                }

                const response: ApiResponse<CommentWithUser> = {
                  success: true,
                  message: 'Comment added successfully',
                  data: comment
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
 * /api/blogs/{id}/comments:
 *   get:
 *     summary: Get comments for a blog post
 *     tags: [Blogs]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Blog ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of comments per page
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       404:
 *         description: Blog not found
 */
router.get('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const blogId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    if (isNaN(blogId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
      return;
    }

    const db = database.getDatabase();

    if (!db) {
      res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
      return;
    }

    // Check if blog exists
    db.get(
      'SELECT id FROM blogs WHERE id = ? AND is_published = 1',
      [blogId],
      (err, blog) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: err.message
          });
          return;
        }

        if (!blog) {
          res.status(404).json({
            success: false,
            message: 'Blog not found'
          });
          return;
        }

        // Get total comments count
        db.get(
          'SELECT COUNT(*) as total FROM comments WHERE blog_id = ?',
          [blogId],
          (countErr, countRow: { total: number }) => {
            if (countErr) {
              res.status(500).json({
                success: false,
                message: 'Database error',
                error: countErr.message
              });
              return;
            }

            const total = countRow.total;
            const totalPages = Math.ceil(total / limit);

            // Get comments
            db.all(
              `SELECT c.*, u.username, u.full_name
               FROM comments c 
               JOIN users u ON c.user_id = u.id 
               WHERE c.blog_id = ?
               ORDER BY c.created_at DESC
               LIMIT ? OFFSET ?`,
              [blogId, limit, offset],
              (commentsErr, comments: CommentWithUser[]) => {
                if (commentsErr) {
                  res.status(500).json({
                    success: false,
                    message: 'Database error',
                    error: commentsErr.message
                  });
                  return;
                }

                const response: PaginatedResponse<CommentWithUser> = {
                  success: true,
                  data: comments,
                  pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                  }
                };

                res.json(response);
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

export default router;
