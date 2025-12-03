import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generateRSAKeyPair, generateECCKeyPair } from '../utils/crypto';
import { initKeyStore, storePrivateKey } from '../utils/keyStorage';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keyAlgorithm, setKeyAlgorithm] = useState('RSA');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    initKeyStore().catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // Generate key pair
      setSuccess('Generating cryptographic keys...');
      let keyPair;
      let keySize;

      if (keyAlgorithm === 'RSA') {
        keyPair = await generateRSAKeyPair();
        keySize = 2048;
      } else {
        keyPair = await generateECCKeyPair();
        keySize = 256;
      }

      // Store private key locally (NEVER sent to server)
      await storePrivateKey(username, keyPair.privateKey, keyAlgorithm, keySize);
      setSuccess('Keys generated and stored securely. Registering...');

      // Register with server (only public key sent)
      const result = await register(
        username,
        password,
        keyPair.publicKey,
        keyAlgorithm,
        keySize
      );

      if (result.success) {
        setSuccess('Registration successful! Redirecting...');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        setError(result.error);
        // Delete stored key if registration failed
        try {
          const { deletePrivateKey } = require('../utils/keyStorage');
          await deletePrivateKey(username);
        } catch (err) {
          console.error('Failed to delete private key:', err);
        }
      }
    } catch (err) {
      setError('Registration failed: ' + (err.message || 'Unknown error'));
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ marginBottom: '24px', textAlign: 'center', color: '#333' }}>
          Secure E2EE Messaging
        </h2>
        <h3 style={{ marginBottom: '24px', textAlign: 'center', color: '#666' }}>
          Register
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              minLength={3}
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Key Algorithm</label>
            <select
              value={keyAlgorithm}
              onChange={(e) => setKeyAlgorithm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            >
              <option value="RSA">RSA (2048 bits)</option>
              <option value="ECC">ECC (P-256)</option>
            </select>
          </div>

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p style={{ marginTop: '20px', textAlign: 'center', color: '#666' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#667eea', textDecoration: 'none' }}>
            Login
          </Link>
        </p>

        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: '#f0f0f0',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#666'
        }}>
          <strong>Security Note:</strong> Your private key is generated and stored only on this device. 
          It is never sent to the server.
        </div>
      </div>
    </div>
  );
}

export default Register;

