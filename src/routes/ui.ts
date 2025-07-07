import { Router, Request, Response } from 'express';
import database from '../config/database';
import { BlogWithAuthor, CommentWithUser, PaginatedResponse } from '../types';

const router = Router();

// Helper function to fetch blogs with pagination
async function fetchBlogs(page: number = 1, limit: number = 10, authorId?: number): Promise<PaginatedResponse<BlogWithAuthor>> {
  return new Promise((resolve, reject) => {
    const db = database.getDatabase();
    if (!db) {
      reject(new Error('Database connection error'));
      return;
    }

    const offset = (page - 1) * limit;
    const whereClause = authorId ? `WHERE b.author_id = ${authorId}` : 'WHERE b.is_published = 1';
    
    // Get total count
    db.get(
      `SELECT COUNT(*) as total FROM blogs b ${whereClause}`,
      [],
      (countErr, countRow: { total: number }) => {
        if (countErr) {
          reject(countErr);
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
           ${whereClause}
           ORDER BY b.created_at DESC
           LIMIT ? OFFSET ?`,
          [limit, offset],
          (err, blogs: BlogWithAuthor[]) => {
            if (err) {
              reject(err);
              return;
            }

            resolve({
              success: true,
              data: blogs,
              pagination: {
                page,
                limit,
                total,
                totalPages
              }
            });
          }
        );
      }
    );
  });
}

// Helper function to fetch user stats
async function fetchUserStats(userId: number): Promise<{ totalBlogs: number; totalLikes: number; totalComments: number }> {
  return new Promise((resolve, reject) => {
    const db = database.getDatabase();
    if (!db) {
      reject(new Error('Database connection error'));
      return;
    }

    // Get total blogs
    db.get(
      'SELECT COUNT(*) as totalBlogs FROM blogs WHERE author_id = ?',
      [userId],
      (err1, blogCount: { totalBlogs: number }) => {
        if (err1) {
          reject(err1);
          return;
        }

        // Get total likes on user's blogs
        db.get(
          `SELECT COUNT(*) as totalLikes FROM likes l 
           JOIN blogs b ON l.blog_id = b.id 
           WHERE b.author_id = ?`,
          [userId],
          (err2, likeCount: { totalLikes: number }) => {
            if (err2) {
              reject(err2);
              return;
            }

            // Get total comments on user's blogs
            db.get(
              `SELECT COUNT(*) as totalComments FROM comments c 
               JOIN blogs b ON c.blog_id = b.id 
               WHERE b.author_id = ?`,
              [userId],
              (err3, commentCount: { totalComments: number }) => {
                if (err3) {
                  reject(err3);
                  return;
                }

                resolve({
                  totalBlogs: blogCount.totalBlogs,
                  totalLikes: likeCount.totalLikes,
                  totalComments: commentCount.totalComments
                });
              }
            );
          }
        );
      }
    );
  });
}

// Home page
router.get('/', async (req: Request, res: Response) => {
  try {
    const blogs = await fetchBlogs(1, 5); // Get latest 5 blogs for home page
    res.render('index', { 
      title: 'Home',
      blogs: blogs.data
    });
  } catch (error) {
    console.error('Error fetching blogs for home page:', error);
    res.render('index', { 
      title: 'Home',
      blogs: []
    });
  }
});

// Login page
router.get('/login', (req: Request, res: Response) => {
  res.render('login', { title: 'Login' });
});

// Register page
router.get('/register', (req: Request, res: Response) => {
  res.render('register', { title: 'Register' });
});

// Blogs listing page
router.get('/blogs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const blogs = await fetchBlogs(page, limit);
    res.render('blogs', { 
      title: 'All Blogs',
      blogs
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.render('blogs', { 
      title: 'All Blogs',
      blogs: { success: false, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }
    });
  }
});

// Individual blog page
router.get('/blogs/:id', async (req: Request, res: Response) => {
  try {
    const blogId = parseInt(req.params.id);
    
    if (isNaN(blogId)) {
      return res.status(404).render('error', { 
        title: 'Not Found',
        message: 'Blog not found'
      });
    }

    const db = database.getDatabase();
    if (!db) {
      return res.status(500).render('error', { 
        title: 'Error',
        message: 'Database connection error'
      });
    }

    // Get blog details
    const blog = await new Promise<BlogWithAuthor>((resolve, reject) => {
      db.get(
        `SELECT b.*, u.username as author_username, u.full_name as author_full_name,
         (SELECT COUNT(*) FROM likes WHERE blog_id = b.id) as likes_count,
         (SELECT COUNT(*) FROM comments WHERE blog_id = b.id) as comments_count
         FROM blogs b 
         JOIN users u ON b.author_id = u.id 
         WHERE b.id = ? AND b.is_published = 1`,
        [blogId],
        (err, result: BlogWithAuthor) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    if (!blog) {
      return res.status(404).render('error', { 
        title: 'Not Found',
        message: 'Blog not found'
      });
    }

    // Get comments
    const commentPage = parseInt(req.query.comment_page as string) || 1;
    const commentLimit = 10;
    const commentOffset = (commentPage - 1) * commentLimit;

    const comments = await new Promise<PaginatedResponse<CommentWithUser>>((resolve, reject) => {
      // Get total comments count
      db.get(
        'SELECT COUNT(*) as total FROM comments WHERE blog_id = ?',
        [blogId],
        (countErr, countRow: { total: number }) => {
          if (countErr) {
            reject(countErr);
            return;
          }

          const total = countRow.total;
          const totalPages = Math.ceil(total / commentLimit);

          // Get comments
          db.all(
            `SELECT c.*, u.username, u.full_name
             FROM comments c 
             JOIN users u ON c.user_id = u.id 
             WHERE c.blog_id = ?
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            [blogId, commentLimit, commentOffset],
            (err, commentList: CommentWithUser[]) => {
              if (err) {
                reject(err);
                return;
              }

              resolve({
                success: true,
                data: commentList,
                pagination: {
                  page: commentPage,
                  limit: commentLimit,
                  total,
                  totalPages
                }
              });
            }
          );
        }
      );
    });

    res.render('blog-detail', { 
      title: blog.title,
      blog,
      comments
    });
  } catch (error) {
    console.error('Error fetching blog details:', error);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Failed to load blog post'
    });
  }
});

// Dashboard page (requires authentication)
router.get('/dashboard', async (req: Request, res: Response) => {
  // Note: In a real app, you'd verify JWT here. For now, we'll render with placeholder data
  // and let the client-side JavaScript load the actual data with the JWT token
  
  // For SSR purposes, we'll provide empty initial data that will be replaced by client-side JS
  res.render('dashboard', { 
    title: 'Dashboard',
    blogs: { 
      success: true, 
      data: [], 
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } 
    },
    stats: { totalBlogs: 0, totalLikes: 0, totalComments: 0 }
  });
});

// Create blog page
router.get('/create-blog', (req: Request, res: Response) => {
  res.render('create-blog', { title: 'Create Blog' });
});

// Edit blog page
router.get('/edit-blog/:id', (req: Request, res: Response) => {
  res.render('edit-blog', { 
    title: 'Edit Blog',
    blogId: req.params.id
  });
});

// Error page
router.get('/error', (req: Request, res: Response) => {
  res.render('error', { 
    title: 'Error',
    message: 'An error occurred'
  });
});

export default router;
