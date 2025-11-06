import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Auth API calls
export const authAPI = {
  register: (userData) => API.post('/auth/register', userData),
  login: (userData) => API.post('/auth/login', userData),
  logout: () => API.post('/auth/logout'),
  getMe: () => API.get('/auth/me'),
  googleAuth: () => {
    window.location.href = '/api/auth/google';
  }
};

export default API;