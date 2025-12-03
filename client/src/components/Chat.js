import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  encryptMessage,
  decryptMessage,
  generateAESKey,
  generateNonce
} from '../utils/crypto';
import { getPrivateKey } from '../utils/keyStorage';
import {
  initiateKeyExchange,
  respondToKeyExchange,
  deriveSessionKey,
  generateKeyConfirmation
} from '../utils/keyExchange';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Chat() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionKey, setSessionKey] = useState(null);
  const [keyExchangeStatus, setKeyExchangeStatus] = useState('idle'); // idle, initiating, pending, completed
  const [sequenceNumber, setSequenceNumber] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (userId) {
      loadUser();
      loadMessages();
      checkKeyExchange();
    }
  }, [userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/user/${userId}`);
      setOtherUser(response.data);
    } catch (error) {
      console.error('Load user error:', error);
      setError('Failed to load user');
    }
  };

  const loadMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/messages/conversation/${userId}`);
      setMessages(response.data);
      
      // Set sequence number based on last message
      if (response.data.length > 0) {
        const lastMessage = response.data[response.data.length - 1];
        if (lastMessage.senderId._id === user.id) {
          setSequenceNumber(lastMessage.sequenceNumber + 1);
        }
      }
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const checkKeyExchange = async () => {
    try {
      const response = await axios.get(`${API_URL}/key-exchange/pending`);
      const pending = response.data.find(
        ex => (ex.initiatorId._id === userId || ex.responderId._id === userId) &&
              (ex.initiatorId._id === user.id || ex.responderId._id === user.id)
      );

      if (pending) {
        if (pending.status === 'pending') {
          setKeyExchangeStatus('pending');
          // If we're the responder, complete the exchange
          if (pending.responderId._id === user.id && !pending.responderPublicKey) {
            await completeKeyExchange(pending);
          }
        } else if (pending.status === 'completed') {
          await establishSessionKey(pending);
        }
      } else {
        // No key exchange, initiate one
        await startKeyExchange();
      }
    } catch (error) {
      console.error('Check key exchange error:', error);
    }
  };

  const startKeyExchange = async () => {
    try {
      setKeyExchangeStatus('initiating');
      setError('');

      const privateKeyData = await getPrivateKey(user.username);
      const keyExchangeData = await initiateKeyExchange(
        userId,
        privateKeyData.privateKey,
        user.username
      );

      const response = await axios.post(`${API_URL}/key-exchange/initiate`, {
        responderId: userId,
        initiatorPublicKey: keyExchangeData.initiatorPublicKey,
        initiatorSignature: keyExchangeData.initiatorSignature
      });

      setKeyExchangeStatus('pending');
      // Store key exchange data for later
      localStorage.setItem(`keyExchange_${userId}`, JSON.stringify({
        ...keyExchangeData,
        keyExchangeId: response.data.keyExchangeId
      }));
    } catch (error) {
      console.error('Key exchange initiation error:', error);
      setError('Failed to initiate key exchange');
      setKeyExchangeStatus('idle');
    }
  };

  const completeKeyExchange = async (keyExchange) => {
    try {
      setKeyExchangeStatus('initiating');
      const privateKeyData = await getPrivateKey(user.username);
      
      const responseData = await respondToKeyExchange(
        keyExchange.initiatorPublicKey,
        keyExchange.initiatorSignature,
        keyExchange.initiatorId.username,
        null, // We generate our own
        privateKeyData.privateKey,
        user.username
      );

      await axios.post(`${API_URL}/key-exchange/respond`, {
        keyExchangeId: keyExchange._id,
        responderPublicKey: responseData.responderPublicKey,
        responderSignature: responseData.responderSignature
      });

      // Update key exchange and establish session
      const updated = await axios.get(`${API_URL}/key-exchange/${keyExchange._id}`);
      await establishSessionKey(updated.data);
    } catch (error) {
      console.error('Complete key exchange error:', error);
      setError('Failed to complete key exchange');
    }
  };

  const establishSessionKey = async (keyExchange) => {
    try {
      const privateKeyData = await getPrivateKey(user.username);
      const storedData = localStorage.getItem(`keyExchange_${userId}`);
      
      if (!storedData) {
        throw new Error('Key exchange data not found');
      }

      const exchangeData = JSON.parse(storedData);
      const isInitiator = keyExchange.initiatorId._id === user.id;

      let myECDHPrivateKey, theirECDHPublicKey;
      
      if (isInitiator) {
        myECDHPrivateKey = exchangeData.ecdhKeyPair.privateKey;
        theirECDHPublicKey = keyExchange.responderPublicKey;
      } else {
        // We need to get our ECDH key pair
        const responseData = await respondToKeyExchange(
          keyExchange.initiatorPublicKey,
          keyExchange.initiatorSignature,
          keyExchange.initiatorId.username,
          null,
          privateKeyData.privateKey,
          user.username
        );
        myECDHPrivateKey = responseData.ecdhKeyPair.privateKey;
        theirECDHPublicKey = keyExchange.initiatorPublicKey;
      }

      const sessionKey = await deriveSessionKey(
        myECDHPrivateKey,
        theirECDHPublicKey,
        keyExchange.initiatorId._id,
        keyExchange.responderId._id
      );

      setSessionKey(sessionKey);
      setKeyExchangeStatus('completed');
      setError('');
    } catch (error) {
      console.error('Establish session key error:', error);
      setError('Failed to establish session key');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !sessionKey) {
      if (!sessionKey) {
        setError('Key exchange not completed. Please wait...');
      }
      return;
    }

    try {
      setError('');
      setLoading(true);

      // Encrypt message
      const encrypted = await encryptMessage(newMessage, sessionKey);
      const nonce = generateNonce();
      const currentSeq = sequenceNumber;

      // Send to server
      await axios.post(`${API_URL}/messages/send`, {
        receiverId: userId,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        nonce: nonce,
        sequenceNumber: currentSeq,
        messageType: 'text'
      });

      // Add to local messages (optimistic update)
      setMessages([...messages, {
        senderId: { _id: user.id, username: user.username },
        receiverId: { _id: userId, username: otherUser?.username },
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        plaintext: newMessage, // Store plaintext locally only
        timestamp: new Date(),
        sequenceNumber: currentSeq
      }]);

      setNewMessage('');
      setSequenceNumber(currentSeq + 1);
    } catch (error) {
      console.error('Send message error:', error);
      if (error.response?.data?.error?.includes('Replay attack')) {
        setError('Replay attack detected! Message rejected.');
      } else {
        setError('Failed to send message');
      }
    } finally {
      setLoading(false);
    }
  };

  const decryptAndDisplayMessage = async (message) => {
    // If already decrypted (local message), return plaintext
    if (message.plaintext) {
      return message.plaintext;
    }

    try {
      if (!sessionKey) {
        return '[Decryption key not available]';
      }

      const decrypted = await decryptMessage(
        {
          ciphertext: message.ciphertext,
          iv: message.iv,
          authTag: message.authTag
        },
        sessionKey
      );
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      // Report decryption failure
      try {
        await axios.post(`${API_URL}/messages/decryption-failure`, {
          messageId: message._id,
          reason: error.message
        });
      } catch (e) {
        console.error('Failed to report decryption failure:', e);
      }
      return '[Decryption failed]';
    }
  };

  useEffect(() => {
    // Decrypt messages when session key is available
    if (sessionKey && messages.length > 0) {
      const decryptMessages = async () => {
        const decryptedMessages = await Promise.all(
          messages.map(async (msg) => {
            if (msg.plaintext) return msg;
            const plaintext = await decryptAndDisplayMessage(msg);
            return { ...msg, plaintext };
          })
        );
        setMessages(decryptedMessages);
      };
      decryptMessages();
    }
  }, [sessionKey]);

  if (!userId) {
    return (
      <div className="container">
        <div className="card">
          <p>Select a user from the dashboard to start chatting</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2>Chat with {otherUser?.username || 'Loading...'}</h2>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              Status: {
                keyExchangeStatus === 'completed' ? '🔒 Encrypted' :
                keyExchangeStatus === 'pending' ? '⏳ Key Exchange Pending' :
                keyExchangeStatus === 'initiating' ? '🔄 Establishing Secure Connection...' :
                '❌ Not Secured'
              }
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {keyExchangeStatus !== 'completed' && (
          <div style={{
            padding: '12px',
            background: '#fff3cd',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {keyExchangeStatus === 'initiating' && 'Establishing secure connection...'}
            {keyExchangeStatus === 'pending' && 'Waiting for key exchange to complete...'}
            {keyExchangeStatus === 'idle' && (
              <div>
                <p>No secure session established. Click to start key exchange:</p>
                <button className="btn btn-primary" onClick={startKeyExchange}>
                  Start Key Exchange
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{
          height: '400px',
          overflowY: 'auto',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          background: '#f9f9f9'
        }}>
          {messages.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', marginTop: '50%' }}>
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.senderId._id === user.id;
              return (
                <div
                  key={idx}
                  style={{
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: isMine ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: isMine ? '#667eea' : 'white',
                    color: isMine ? 'white' : '#333',
                    border: isMine ? 'none' : '1px solid #e0e0e0'
                  }}>
                    <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>
                      {isMine ? 'You' : msg.senderId.username}
                    </div>
                    <div>{msg.plaintext || '[Decrypting...]'}</div>
                    <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={sessionKey ? "Type a message..." : "Establishing secure connection..."}
            disabled={!sessionKey || loading}
            style={{ flex: 1, padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px' }}
          />
          <button
            className="btn btn-primary"
            onClick={sendMessage}
            disabled={!sessionKey || loading || !newMessage.trim()}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;

