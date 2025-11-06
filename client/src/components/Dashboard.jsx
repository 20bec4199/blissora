import React from 'react';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="container">
          <div className="navbar-content">
            <h1>Dashboard</h1>
            <div className="user-info">
              {user?.avatar && (
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="user-avatar"
                />
              )}
              <span>Welcome, {user?.name}</span>
              <button className="btn-logout" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container">
        <div className="dashboard-content">
          <h2>Welcome to your Dashboard!</h2>
          <div className="user-details">
            <p><strong>Name:</strong> {user?.name}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Login Method:</strong> {user?.googleId ? 'Google OAuth' : 'Email/Password'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;