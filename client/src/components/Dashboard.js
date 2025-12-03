import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
// Dashboard component for user interactions
// --- IGNORE ---
function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  // Poll for incoming chat/key-exchange requests where current user is responder
  useEffect(() => {
    if (!user) return;

    const fetchIncoming = async () => {
      try {
        const response = await axios.get(`${API_URL}/key-exchange/pending`);
        const currentUserId = user.id || user._id;

        const pendingForMe = response.data.filter((ex) => {
          const responderId = ex.responderId._id || ex.responderId;
          return responderId === currentUserId && ex.status === 'pending';
        });

        setIncomingRequests(pendingForMe);
      } catch (error) {
        console.error('Fetch incoming requests error:', error);
      }
    };

    // Initial fetch
    fetchIncoming();
    // Poll every 5 seconds
    const intervalId = setInterval(fetchIncoming, 5000);

    return () => clearInterval(intervalId);
  }, [user]);

  const searchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/auth/users/search`, {
        params: { q: searchQuery }
      });
      // Filter out current user
      const filteredUsers = response.data.filter(u => u._id !== user.id && u._id !== user._id);
      setUsers(filteredUsers);
    } catch (error) {
      console.error('User search error:', error);
      setUsers([]);
      if (error.response?.status === 401) {
        alert('Session expired. Please login again.');
        logout();
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const startChat = (userId) => {
    navigate(`/chat/${userId}`);
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1>Dashboard</h1>
            <p style={{ color: '#666', marginTop: '8px' }}>
              Welcome, <strong>{user?.username}</strong>
            </p>
          </div>
          <div>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/files')}
              style={{ marginRight: '10px' }}
            >
              Files
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/audit')}
              style={{ marginRight: '10px' }}
            >
              Audit Logs
            </button>
            <button className="btn btn-danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>Search Users to Start Chat</label>
          <input
            type="text"
            placeholder="Type username to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading && <p>Searching...</p>}

        {users.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3>Search Results</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {users.map((u) => (
                <div
                  key={u._id}
                  style={{
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong>{u.username}</strong>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      {u.keyAlgorithm} ({u.keySize || 'N/A'} bits)
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => startChat(u._id)}
                  >
                    Start Chat
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchQuery.length >= 2 && !loading && users.length === 0 && (
          <p style={{ color: '#666', marginTop: '20px' }}>No users found</p>
        )}
      </div>

      {incomingRequests.length > 0 && (
        <div className="card">
          <h2>Incoming Chat Requests</h2>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {incomingRequests.map((req) => (
              <div
                key={req._id}
                style={{
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{req.initiatorId?.username || 'Unknown user'}</strong>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Chat request pending
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/chat/${req.initiatorId?._id || req.initiatorId}`)}
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Security Information</h2>
        <div style={{ marginTop: '16px' }}>
          <p><strong>Your Public Key Algorithm:</strong> {user?.keyAlgorithm || 'N/A'}</p>
          <p><strong>Key Size:</strong> {user?.keySize || 'N/A'} bits</p>
          <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
            Your private key is stored securely on this device only. 
            It is never transmitted to the server.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

