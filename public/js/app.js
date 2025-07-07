// Theme switching functionality
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;
  
  // Check for saved theme or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  body.setAttribute('data-theme', savedTheme);
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      body.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
}

// Like functionality
function initLikeButtons() {
  const likeButtons = document.querySelectorAll('.like-btn');
  
  likeButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const blogId = button.dataset.blogId;
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Please login to like posts');
        return;
      }
      
      try {
        const response = await fetch(`/api-flux-api/blogs/${blogId}/like`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Toggle like button state
          button.classList.toggle('liked');
          const likeCount = button.querySelector('.like-count');
          const currentCount = parseInt(likeCount.textContent);
          
          if (button.classList.contains('liked')) {
            likeCount.textContent = currentCount + 1;
          } else {
            likeCount.textContent = currentCount - 1;
          }
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error('Error liking post:', error);
        alert('Error liking post');
      }
    });
  });
}

// Form submission helpers
function initForms() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(loginForm);
      const data = {
        email: formData.get('email'),
        password: formData.get('password')
      };
      
      try {
        const response = await fetch('/api-flux-api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
          localStorage.setItem('token', result.data.access_token);
          localStorage.setItem('user', JSON.stringify(result.data.user));
          window.location.href = '/api-flux-blog/dashboard';
        } else {
          showAlert(result.message, 'danger');
        }
      } catch (error) {
        console.error('Login error:', error);
        showAlert('Login failed', 'danger');
      }
    });
  }
  
  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(registerForm);
      const data = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        full_name: formData.get('full_name')
      };
      
      try {
        const response = await fetch('/api-flux-api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
          localStorage.setItem('token', result.data.access_token);
          localStorage.setItem('user', JSON.stringify(result.data.user));
          window.location.href = '/api-flux-blog/dashboard';
        } else {
          showAlert(result.message, 'danger');
        }
      } catch (error) {
        console.error('Registration error:', error);
        showAlert('Registration failed', 'danger');
      }
    });
  }
}

// Alert helper
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) return;
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  alertContainer.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

// Comment functionality
function initComments() {
  const commentForms = document.querySelectorAll('.comment-form');
  
  commentForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const blogId = form.dataset.blogId;
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Please login to comment');
        return;
      }
      
      const formData = new FormData(form);
      const data = {
        content: formData.get('content')
      };
      
      try {
        const response = await fetch(`/api-flux-api/blogs/${blogId}/comments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Reload the page to show new comment
          window.location.reload();
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error('Error posting comment:', error);
        alert('Error posting comment');
      }
    });
  });
}

// Auth state management
function initAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  const authElements = document.querySelectorAll('[data-auth-required]');
  const noAuthElements = document.querySelectorAll('[data-no-auth]');
  
  if (token && user) {
    // User is logged in
    authElements.forEach(el => el.style.display = 'block');
    noAuthElements.forEach(el => el.style.display = 'none');
    
    // Update user info in nav
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
      const userData = JSON.parse(user);
      userInfo.textContent = userData.username;
    }
  } else {
    // User is not logged in
    authElements.forEach(el => el.style.display = 'none');
    noAuthElements.forEach(el => el.style.display = 'block');
  }
}

// Logout functionality
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/api-flux-blog/';
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLikeButtons();
  initForms();
  initComments();
  initAuth();
});

// Make logout function global
window.logout = logout;
