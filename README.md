# Secure End-to-End Encrypted Messaging & File-Sharing System

A comprehensive secure communication system that provides end-to-end encryption (E2EE) for text messaging and file sharing. This project implements hybrid cryptography combining asymmetric encryption (RSA/ECC) with symmetric encryption (AES-GCM), along with a custom key exchange protocol.

## 🎯 Project Overview

This system ensures that:
- Messages and files never exist in plaintext outside the sender or receiver device
- The server is unable to decrypt or view any user content
- All encryption happens client-side using Web Crypto API
- Private keys are never stored on the server
- Comprehensive security logging and threat detection

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────┐         HTTPS          ┌─────────────┐
│   Client    │ ◄──────────────────► │   Server    │
│  (React)    │                       │ (Node.js)   │
│             │                       │             │
│ - Web Crypto│                       │ - Express   │
│ - IndexedDB │                       │ - MongoDB   │
│ - E2EE      │                       │ - Logging   │
└─────────────┘                       └─────────────┘
```

### Key Exchange Protocol Flow

```
1. Initiator (Alice)                    Responder (Bob)
   │                                        │
   │── ECDH Public Key + Signature ────────>│
   │                                        │
   │<── ECDH Public Key + Signature ────────│
   │                                        │
   │── Key Confirmation ───────────────────>│
   │                                        │
   │<── Key Confirmation ───────────────────│
   │                                        │
   Both derive session key using ECDH + HKDF
```

## 🚀 Features

### Core Features
- ✅ **User Authentication**: Secure registration and login with bcrypt password hashing
- ✅ **Key Generation**: RSA-2048 or ECC-P256 key pairs generated client-side
- ✅ **Secure Key Storage**: Private keys stored only in IndexedDB (client-side)
- ✅ **Custom Key Exchange**: ECDH-based key exchange with digital signatures
- ✅ **End-to-End Encryption**: AES-256-GCM for all messages
- ✅ **Encrypted File Sharing**: Files encrypted and chunked before upload
- ✅ **Replay Attack Protection**: Nonces, timestamps, and sequence numbers
- ✅ **MITM Attack Prevention**: Digital signatures on key exchange
- ✅ **Security Auditing**: Comprehensive logging of all security events
- ✅ **Threat Modeling**: STRIDE analysis and documentation

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🔧 Quick Setup

### 1. Install Dependencies
```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 2. Configure Environment
```bash
cd server
cp .env.example .env
```
Edit `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/e2ee_messaging
JWT_SECRET=your-secret-key-here
PORT=5000
```

### 3. Start MongoDB
```bash
# Windows: mongod
# Linux/Mac: sudo systemctl start mongod
```

## 🚀 Run Application

**Quick Start:**
```bash
npm run dev
```

**Or separately:**
```bash
# Terminal 1
cd server && npm run dev

# Terminal 2  
cd client && npm start
```

**Access:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Production Mode

```bash
# Build client
cd client
npm run build

# Start server
cd ../server
npm start
```

## 🧪 Running Attack Demonstrations

### MITM Attack Demonstration

```bash
cd attacks
npm run mitm
```

This demonstrates:
- How MITM attacks work without digital signatures
- How digital signatures prevent MITM attacks

### Replay Attack Demonstration

```bash
cd attacks
npm run replay
```

This demonstrates:
- How replay attacks work without protection
- How nonces, timestamps, and sequence numbers prevent replay attacks

## 📁 Project Structure

```
.
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # React context (Auth)
│   │   ├── utils/         # Cryptographic utilities
│   │   │   ├── crypto.js          # Web Crypto API wrappers
│   │   │   ├── keyStorage.js     # IndexedDB key storage
│   │   │   └── keyExchange.js    # Key exchange protocol
│   │   └── App.js
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── models/           # MongoDB models
│   │   ├── User.js
│   │   ├── Message.js
│   │   ├── File.js
│   │   ├── KeyExchange.js
│   │   └── AuditLog.js
│   ├── routes/           # API routes
│   │   ├── auth.js
│   │   ├── messages.js
│   │   ├── files.js
│   │   ├── keyExchange.js
│   │   └── audit.js
│   ├── middleware/       # Express middleware
│   │   └── auth.js
│   ├── utils/            # Utilities
│   │   └── logger.js
│   ├── logs/             # Log files (generated)
│   └── index.js
│
├── attacks/              # Attack demonstration scripts
│   ├── mitm-attack.js
│   ├── replay-attack.js
│   └── package.json
│
├── docs/                 # Documentation
│   └── THREAT_MODEL.md
│
└── README.md
```

## 🔐 Security Features

### Encryption
- **Asymmetric**: RSA-2048 or ECC-P256
- **Symmetric**: AES-256-GCM
- **Key Derivation**: HKDF with SHA-256
- **Hashing**: SHA-256

### Key Management
- Private keys stored only in IndexedDB (client-side)
- Private keys never transmitted to server
- Session keys derived from ECDH shared secret

### Attack Prevention
- **MITM**: Digital signatures on key exchange
- **Replay**: Nonces, timestamps, sequence numbers
- **Tampering**: AES-GCM authentication tags
- **Information Disclosure**: Client-side encryption only

### Logging
- Authentication attempts
- Key exchange events
- Message operations
- Security events (warnings, errors, critical)
- Replay attack detections
- Decryption failures

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/user/:userId` - Get user by ID
- `GET /api/auth/users/search?q=username` - Search users

### Key Exchange
- `POST /api/key-exchange/initiate` - Initiate key exchange
- `POST /api/key-exchange/respond` - Respond to key exchange
- `POST /api/key-exchange/confirm` - Send key confirmation
- `GET /api/key-exchange/pending` - Get pending exchanges
- `GET /api/key-exchange/:keyExchangeId` - Get exchange details

### Messages
- `POST /api/messages/send` - Send encrypted message
- `GET /api/messages/conversation/:otherUserId` - Get conversation
- `POST /api/messages/decryption-failure` - Report decryption failure

### Files
- `POST /api/files/upload` - Upload encrypted file
- `GET /api/files/:fileId` - Download encrypted file
- `GET /api/files` - List user's files

### Audit
- `GET /api/audit/my-logs` - Get user's audit logs
- `GET /api/audit/security-events` - Get security events

## 🧪 Testing

### Manual Testing

1. **Register Users**:
   - Register two users (e.g., "alice" and "bob")
   - Note: Private keys are generated and stored locally

2. **Start Chat**:
   - Login as alice
   - Search for bob
   - Start chat
   - Key exchange will initiate automatically

3. **Send Messages**:
   - Messages are encrypted client-side
   - Server only stores ciphertext
   - Messages are decrypted client-side on receive

4. **Upload Files**:
   - Select a file
   - Enter receiver username
   - File is encrypted and chunked before upload

5. **View Audit Logs**:
   - Navigate to Audit Logs
   - View security events and user activity

### Attack Demonstrations

Run the attack demonstration scripts to see how the system prevents MITM and replay attacks.

## 📝 Documentation

- **Threat Modeling**: See `docs/THREAT_MODEL.md` for comprehensive STRIDE analysis
- **Key Exchange Protocol**: See `client/src/utils/keyExchange.js` for protocol implementation
- **Cryptographic Functions**: See `client/src/utils/crypto.js` for encryption/decryption

## ⚠️ Security Considerations

### Current Implementation
- ✅ Client-side encryption
- ✅ Private keys never on server
- ✅ Digital signatures
- ✅ Replay attack protection
- ✅ Comprehensive logging

### Recommendations for Production
- ⚠️ Implement rate limiting
- ⚠️ Use HTTPS in production
- ⚠️ Implement key backup/recovery
- ⚠️ Add token refresh mechanism
- ⚠️ Implement certificate pinning
- ⚠️ Set up real-time monitoring
- ⚠️ Regular security audits

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify MongoDB port (default: 27017)

### Key Storage Issues
- Clear browser IndexedDB if needed
- Check browser console for errors
- Ensure Web Crypto API is supported

### Port Conflicts
- Change `PORT` in server `.env`
- Change React port: `PORT=3001 npm start` in client

## 📄 License

This project is for educational purposes as part of an Information Security course.

## 👥 Team

This project was developed by a team of 3 students for BSSE 7th Semester Information Security course.

## 🙏 Acknowledgments

- Web Crypto API documentation
- Node.js crypto module
- MongoDB documentation
- React documentation

---

**Note**: This is an educational project. For production use, additional security measures and professional security audits are recommended.

