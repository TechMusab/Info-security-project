# Quick Start Guide

## Prerequisites
- Node.js (v16+)
- MongoDB running on localhost:27017

## Setup (One Time)

1. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install && cd ..
   cd client && npm install && cd ..
   ```

2. **Configure environment:**
   ```bash
   cd server
   cp .env.example .env
   ```
   Edit `.env` and set:
   ```
   MONGODB_URI=mongodb://localhost:27017/e2ee_messaging
   JWT_SECRET=your-secret-key-here
   ```

## Run Application

**Option 1: Run both together (recommended)**
```bash
npm run dev
```

**Option 2: Run separately**
```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client  
cd client
npm start
```

## Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## First Steps
1. Register a user (keys generated automatically)
2. Register another user
3. Login and search for the other user
4. Start chatting (key exchange happens automatically)

## Run Attack Demonstrations
```bash
cd attacks
npm install
npm run mitm      # MITM attack demo
npm run replay    # Replay attack demo
```

