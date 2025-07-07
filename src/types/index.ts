export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  full_name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Blog {
  id: number;
  title: string;
  content: string;
  excerpt?: string;
  author_id: number;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BlogWithAuthor extends Blog {
  author_username: string;
  author_full_name?: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
}

export interface Comment {
  id: number;
  content: string;
  user_id: number;
  blog_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface CommentWithUser extends Comment {
  username: string;
  full_name?: string;
}

export interface Like {
  id: number;
  user_id: number;
  blog_id: number;
  created_at: Date;
}

export interface AuthTokens {
  access_token: string;
  user: UserResponse;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JwtPayload {
  userId: number;
  username: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
