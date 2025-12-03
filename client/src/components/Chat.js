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
        ex => {
          const initiatorId = ex.initiatorId._id || ex.initiatorId;
          const responderId = ex.responderId._id || ex.responderId;
          const currentUserId = user.id || user._id;
          return (initiatorId === userId || responderId === userId) &&
                 (initiatorId === currentUserId || responderId === currentUserId);
        }
      );

      if (pending) {
        if (pending.status === 'pending') {
          setKeyExchangeStatus('pending');
          const responderId = pending.responderId._id || pending.responderId;
          const currentUserId = user.id || user._id;
          
          // If we're the responder and haven't responded yet, complete the exchange
          if (responderId === currentUserId && !pending.responderPublicKey) {
            await completeKeyExchange(pending);
          } 
          // If we're the initiator and responder has responded, establish session
          else if (responderId !== currentUserId && pending.responderPublicKey) {
            await establishSessionKey(pending);
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
      // If no pending exchanges found, start a new one
      if (error.response?.status === 404 || !error.response) {
        await startKeyExchange();
      }
    }
  };

  const startKeyExchange = async () => {
    try {
      setKeyExchangeStatus('initiating');
      setError('');

      const privateKeyData = await getPrivateKey(user.username);
      if (!privateKeyData || !privateKeyData.privateKey) {
        throw new Error('Private key not found. Please register again.');
      }

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
      // Store key exchange data for later (including ECDH key pair)
      // The ecdhKeyPair contains a CryptoKeyPair object with .keyPair.privateKey
      if (!keyExchangeData.ecdhKeyPair || !keyExchangeData.ecdhKeyPair.keyPair || !keyExchangeData.ecdhKeyPair.keyPair.privateKey) {
        throw new Error('ECDH key pair structure invalid');
      }
      
      // Export the private key to base64 for storage
      const ecdhPrivateKey = await window.crypto.subtle.exportKey('pkcs8', keyExchangeData.ecdhKeyPair.keyPair.privateKey);
      
      // Use proper base64 conversion
      const ecdhPrivateKeyArray = new Uint8Array(ecdhPrivateKey);
      let binary = '';
      for (let i = 0; i < ecdhPrivateKeyArray.byteLength; i++) {
        binary += String.fromCharCode(ecdhPrivateKeyArray[i]);
      }
      const ecdhPrivateKeyBase64 = btoa(binary);
      
      localStorage.setItem(`keyExchange_${userId}`, JSON.stringify({
        ecdhPrivateKey: ecdhPrivateKeyBase64,
        keyExchangeId: response.data.keyExchangeId,
        isInitiator: true
      }));
    } catch (error) {
      console.error('Key exchange initiation error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      setError('Failed to initiate key exchange: ' + errorMessage);
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

      // Store responder's ECDH key pair for later use
      // The ecdhKeyPair from respondToKeyExchange contains the CryptoKeyPair object
      // We need to export the private key to base64 for storage
      if (!responseData.ecdhKeyPair || !responseData.ecdhKeyPair.keyPair || !responseData.ecdhKeyPair.keyPair.privateKey) {
        throw new Error('ECDH key pair not generated correctly');
      }
      
      // Export the private key to base64
      const ecdhPrivateKey = await window.crypto.subtle.exportKey('pkcs8', responseData.ecdhKeyPair.keyPair.privateKey);
      const ecdhPrivateKeyArray = new Uint8Array(ecdhPrivateKey);
      let binary = '';
      for (let i = 0; i < ecdhPrivateKeyArray.byteLength; i++) {
        binary += String.fromCharCode(ecdhPrivateKeyArray[i]);
      }
      const ecdhPrivateKeyBase64 = btoa(binary);
      
      localStorage.setItem(`keyExchange_${userId}`, JSON.stringify({
        ecdhPrivateKey: ecdhPrivateKeyBase64,
        isInitiator: false
      }));

      // Validate data before sending
      if (!keyExchange._id || !responseData.responderPublicKey || !responseData.responderSignature) {
        throw new Error('Missing required key exchange data');
      }

      const respondResponse = await axios.post(`${API_URL}/key-exchange/respond`, {
        keyExchangeId: keyExchange._id,
        responderPublicKey: responseData.responderPublicKey,
        responderSignature: responseData.responderSignature
      });

      if (respondResponse.status !== 200) {
        throw new Error('Failed to send key exchange response');
      }

      // Update key exchange and establish session
      const updated = await axios.get(`${API_URL}/key-exchange/${keyExchange._id}`);
      await establishSessionKey(updated.data);
    } catch (error) {
      console.error('Complete key exchange error:', error);
      setError('Failed to complete key exchange: ' + (error.message || 'Unknown error'));
    }
  };

  const establishSessionKey = async (keyExchange) => {
    try {
      const storedData = localStorage.getItem(`keyExchange_${userId}`);
      
      if (!storedData) {
        throw new Error('Key exchange data not found in localStorage');
      }

      const exchangeData = JSON.parse(storedData);
      const isInitiator = keyExchange.initiatorId._id === user.id || keyExchange.initiatorId._id === user._id;

      let myECDHPrivateKey, theirECDHPublicKey;
      
      if (isInitiator) {
        // Initiator uses stored ECDH private key
        if (!exchangeData.ecdhPrivateKey) {
          throw new Error('Initiator ECDH private key not found in storage');
        }
        myECDHPrivateKey = exchangeData.ecdhPrivateKey;
        
        if (!keyExchange.responderPublicKey) {
          throw new Error('Responder public key not available yet. Wait for key exchange to complete.');
        }
        theirECDHPublicKey = keyExchange.responderPublicKey;
      } else {
        // Responder uses stored ECDH private key from completeKeyExchange
        if (!exchangeData.ecdhPrivateKey) {
          throw new Error('Responder ECDH private key not found in storage');
        }
        myECDHPrivateKey = exchangeData.ecdhPrivateKey;
        theirECDHPublicKey = keyExchange.initiatorPublicKey;
      }

      const sessionKey = await deriveSessionKey(
        myECDHPrivateKey,
        theirECDHPublicKey,
        keyExchange.initiatorId._id || keyExchange.initiatorId,
        keyExchange.responderId._id || keyExchange.responderId
      );

      setSessionKey(sessionKey);
      setKeyExchangeStatus('completed');
      setError('');
    } catch (error) {
      console.error('Establish session key error:', error);
      setError('Failed to establish session key: ' + (error.message || 'Unknown error'));
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

