# Testing Guide & Wireshark Instructions

## Next Steps After Starting Frontend

### 1. Start the Backend Server

Open a **new terminal** and run:

```bash
cd server
npm install  # If not already done
npm run dev
```

The server should start on port 5000.

### 2. Test the Application

1. **Register First User:**
   - Go to http://localhost:3000
   - Click "Register"
   - Enter username (e.g., "alice")
   - Enter password (min 8 characters)
   - Select key algorithm (RSA or ECC)
   - Click Register
   - Wait for key generation (may take a few seconds)

2. **Register Second User:**
   - Logout
   - Register another user (e.g., "bob")

3. **Test Messaging:**
   - Login as "alice"
   - Search for "bob"
   - Click "Start Chat"
   - Wait for key exchange to complete
   - Send encrypted messages

4. **Test File Sharing:**
   - Go to Files section
   - Upload a file
   - Download files

5. **View Audit Logs:**
   - Go to Audit Logs section
   - View security events

---

## Wireshark Setup & Usage

### Why Wireshark?

The project requires packet captures to demonstrate:
- Encrypted traffic (HTTPS/TLS)
- Key exchange messages
- Encrypted message transmission
- Attack demonstrations

### Step 1: Install Wireshark

1. Download from: https://www.wireshark.org/download.html
2. Install with default settings
3. **Important**: During installation, install Npcap (for Windows packet capture)

### Step 2: Capture Network Traffic

#### Option A: Capture Localhost Traffic (Recommended)

1. **Start Wireshark**
2. **Select Loopback Interface:**
   - Look for "Loopback" or "Adapter for loopback traffic capture"
   - On Windows: May need to use "Npcap Loopback Adapter"
   - If not available, install Npcap separately

3. **Start Capture:**
   - Click on the loopback interface
   - Click "Start capturing packets" (blue shark fin icon)

4. **Filter for HTTP/HTTPS:**
   - In the filter box, type: `http || tls || tcp.port == 5000 || tcp.port == 3000`
   - Press Enter

5. **Run Your Application:**
   - Start server and client
   - Perform actions (register, login, send messages)

6. **Stop Capture:**
   - Click red square button
   - Save the capture file as `e2ee_traffic.pcapng`

#### Option B: Capture on Network Interface

If loopback doesn't work:

1. **Find your network interface:**
   - Look for "Ethernet" or "Wi-Fi" adapter
   - Note the IP address (should be your local IP)

2. **Start capture on that interface**

3. **Access app via network IP:**
   - Instead of localhost:3000, use your IP:3000
   - Example: http://192.168.1.100:3000

### Step 3: Analyze Captured Traffic

#### What to Look For:

1. **TLS/HTTPS Handshake:**
   - Filter: `tls.handshake`
   - Shows encrypted connection establishment
   - **Screenshot**: TLS handshake packets

2. **HTTP Requests to API:**
   - Filter: `http.request`
   - Look for:
     - POST /api/auth/register
     - POST /api/auth/login
     - POST /api/key-exchange/initiate
     - POST /api/messages/send
   - **Screenshot**: API request packets

3. **Encrypted Payloads:**
   - Filter: `tcp.port == 5000`
   - Show encrypted data (ciphertext)
   - **Screenshot**: Encrypted message payload

4. **Key Exchange Traffic:**
   - Filter: `http.request.uri contains "key-exchange"`
   - Shows key exchange API calls
   - **Screenshot**: Key exchange requests

### Step 4: Create Screenshots for Report

Take screenshots of:

1. **Wireshark capture window** showing:
   - Filter applied
   - Encrypted packets
   - Packet details (encrypted payload visible)

2. **Specific packets:**
   - Right-click packet → "Follow" → "TCP Stream"
   - Screenshot the encrypted data

3. **Statistics:**
   - Statistics → Protocol Hierarchy
   - Shows protocol distribution

### Step 5: Demonstrate Security

#### Show Encrypted Traffic:

1. **Capture during message send:**
   - Start capture
   - Send a message: "Hello, this is a secret message"
   - Stop capture

2. **Analyze:**
   - Search for the message text in Wireshark
   - **Result**: Should NOT find plaintext (proves encryption works)
   - Filter: `tcp contains "Hello"` → Should return no results

3. **Show encrypted payload:**
   - Find POST /api/messages/send packet
   - Expand packet details
   - Show encrypted payload (ciphertext)
   - **Screenshot**: Encrypted data

#### Demonstrate MITM Prevention:

1. **Capture key exchange:**
   - Start capture
   - Initiate chat between two users
   - Capture key exchange packets

2. **Show:**
   - Key exchange requests contain signatures
   - Traffic is encrypted (TLS)
   - **Screenshot**: Key exchange with signatures

---

## BurpSuite Setup (Alternative/Additional)

### Install BurpSuite Community Edition

1. Download from: https://portswigger.net/burp/communitydownload
2. Install and launch

### Configure Proxy

1. **BurpSuite Settings:**
   - Proxy → Options
   - Note proxy port (default: 8080)

2. **Browser Configuration:**
   - Install BurpSuite CA certificate
   - Configure browser to use proxy: localhost:8080

3. **Capture Traffic:**
   - Enable intercept in BurpSuite
   - Perform actions in app
   - View intercepted requests

### What to Capture:

1. **API Requests:**
   - Registration requests
   - Login requests
   - Key exchange requests
   - Message sending requests

2. **Show Encrypted Payloads:**
   - Request/Response bodies
   - Encrypted ciphertext
   - **Screenshot**: BurpSuite showing encrypted data

---

## Screenshots Checklist for Report

- [ ] Wireshark capture window with encrypted packets
- [ ] TLS handshake packets
- [ ] API request packets (POST /api/messages/send)
- [ ] Encrypted payload (ciphertext visible, plaintext not visible)
- [ ] Key exchange packets
- [ ] Protocol statistics
- [ ] Search for plaintext message (should return no results)
- [ ] BurpSuite intercept (if used)

---

## Tips

1. **Use filters** to focus on relevant traffic
2. **Save captures** for later analysis
3. **Take screenshots** with clear labels
4. **Document** what each screenshot demonstrates
5. **Show both** encrypted traffic AND that plaintext is not visible

---

## Common Issues

### Can't see localhost traffic:
- Use loopback adapter
- Or access via network IP

### Too much traffic:
- Use filters to narrow down
- Filter by port: `tcp.port == 5000`

### Can't find plaintext:
- That's good! It means encryption is working
- Document this as proof of encryption

---

## For Attack Demonstrations

### MITM Attack Demo:
1. Capture key exchange without signatures (theoretical)
2. Show how signatures prevent MITM
3. Screenshot: Signature verification in packets

### Replay Attack Demo:
1. Capture a message send
2. Show nonce/timestamp in packet
3. Screenshot: Replay protection fields

