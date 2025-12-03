import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  encryptMessage,
  decryptMessage,
  generateNonce
} from '../utils/crypto';
import { getPrivateKey } from '../utils/keyStorage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

function Files() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [receiverId, setReceiverId] = useState('');
  const [receiverUsername, setReceiverUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const response = await axios.get(`${API_URL}/files`);
      setFiles(response.data);
    } catch (error) {
      console.error('Load files error:', error);
      setError('Failed to load files');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const encryptFile = async (file, sessionKey) => {
    const chunks = [];
    const fileReader = new FileReader();

    return new Promise((resolve, reject) => {
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
            const chunk = arrayBuffer.slice(start, end);

            // Convert chunk to string for encryption
            const chunkString = new TextDecoder().decode(chunk);
            const encrypted = await encryptMessage(chunkString, sessionKey);

            chunks.push({
              ciphertext: encrypted.ciphertext,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
              chunkIndex: i
            });
          }

          resolve(chunks);
        } catch (error) {
          reject(error);
        }
      };

      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(file);
    });
  };

  const uploadFile = async () => {
    if (!selectedFile || !receiverId) {
      setError('Please select a file and enter receiver username');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // For file sharing, we need a session key
      // In a real implementation, you'd establish this via key exchange
      // For now, we'll use a simplified approach
      const { generateAESKey } = require('../utils/crypto');
      const sessionKey = await generateAESKey();

      // Encrypt file
      const encryptedChunks = await encryptFile(selectedFile, sessionKey);

      // Upload to server
      const formData = new FormData();
      formData.append('receiverId', receiverId);
      formData.append('filename', selectedFile.name);
      formData.append('mimeType', selectedFile.type);
      formData.append('originalSize', selectedFile.size);
      formData.append('chunks', JSON.stringify(encryptedChunks));

      await axios.post(`${API_URL}/files/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setError('');
      alert('File uploaded successfully!');
      setSelectedFile(null);
      setReceiverId('');
      setReceiverUsername('');
      loadFiles();
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload file: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const decryptFile = async (fileData, sessionKey) => {
    try {
      // Sort chunks by index
      const sortedChunks = [...fileData.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Decrypt each chunk
      const decryptedChunks = await Promise.all(
        sortedChunks.map(chunk =>
          decryptMessage(
            {
              ciphertext: chunk.ciphertext,
              iv: chunk.iv,
              authTag: chunk.authTag
            },
            sessionKey
          )
        )
      );

      // Combine chunks
      const combinedText = decryptedChunks.join('');
      const arrayBuffer = new TextEncoder().encode(combinedText).buffer;

      return arrayBuffer;
    } catch (error) {
      console.error('Decrypt file error:', error);
      throw new Error('Failed to decrypt file');
    }
  };

  const downloadFile = async (file) => {
    try {
      setLoading(true);
      setError('');

      // Get encrypted file
      const response = await axios.get(`${API_URL}/files/${file._id}`);

      // For demo, we'll need the session key
      // In production, this would be stored securely after key exchange
      const { generateAESKey } = require('../utils/crypto');
      const sessionKey = await generateAESKey(); // This is simplified - should use actual session key

      // Decrypt file
      const decryptedData = await decryptFile(response.data, sessionKey);

      // Create blob and download
      const blob = new Blob([decryptedData], { type: response.data.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download file. Decryption key may be missing.');
    } finally {
      setLoading(false);
    }
  };

  const searchUser = async (username) => {
    try {
      const response = await axios.get(`${API_URL}/auth/users/search`, {
        params: { q: username }
      });
      if (response.data.length > 0) {
        const foundUser = response.data[0];
        setReceiverId(foundUser._id);
        setReceiverUsername(foundUser.username);
      } else {
        setError('User not found');
      }
    } catch (error) {
      console.error('Search user error:', error);
      setError('Failed to search user');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>File Sharing</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div style={{ marginBottom: '20px' }}>
          <h3>Upload Encrypted File</h3>
          <div className="input-group">
            <label>Select File</label>
            <input type="file" onChange={handleFileSelect} />
            {selectedFile && (
              <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <div className="input-group">
            <label>Receiver Username</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={receiverUsername}
                onChange={(e) => setReceiverUsername(e.target.value)}
                placeholder="Enter username"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary"
                onClick={() => searchUser(receiverUsername)}
              >
                Search
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={uploadFile}
            disabled={!selectedFile || !receiverId || loading}
          >
            {loading ? 'Uploading...' : 'Upload Encrypted File'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>My Files</h3>
        {files.length === 0 ? (
          <p style={{ color: '#666' }}>No files yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {files.map((file) => (
              <div
                key={file._id}
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
                  <strong>{file.filename}</strong>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    {(file.originalSize / 1024).toFixed(2)} KB • 
                    {file.senderId._id === user.id ? ' Sent to ' : ' Received from '}
                    {file.senderId._id === user.id ? file.receiverId.username : file.senderId.username}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => downloadFile(file)}
                  disabled={loading}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Files;

