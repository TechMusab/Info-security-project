/**
 * Cryptographic utilities using Web Crypto API
 * All encryption/decryption happens client-side
 */

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert string to ArrayBuffer
function stringToArrayBuffer(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// Convert ArrayBuffer to string
function arrayBufferToString(buffer) {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}

/**
 * Generate RSA key pair (2048 bits)
 */
export async function generateRSAKeyPair() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );

    // Export keys
    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey: arrayBufferToBase64(publicKey),
      privateKey: arrayBufferToBase64(privateKey),
      keyPair: keyPair // Keep for use
    };
  } catch (error) {
    console.error('RSA key generation error:', error);
    throw error;
  }
}

/**
 * Generate ECC key pair (P-256)
 */
export async function generateECCKeyPair() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );

    // Export keys
    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey: arrayBufferToBase64(publicKey),
      privateKey: arrayBufferToBase64(privateKey),
      keyPair: keyPair
    };
  } catch (error) {
    console.error('ECC key generation error:', error);
    throw error;
  }
}

/**
 * Import RSA public key from base64
 */
export async function importRSAPublicKey(base64Key) {
  try {
    const keyData = base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );
  } catch (error) {
    console.error('RSA public key import error:', error);
    throw error;
  }
}

/**
 * Import RSA private key from base64
 */
export async function importRSAPrivateKey(base64Key) {
  try {
    const keyData = base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['decrypt']
    );
  } catch (error) {
    console.error('RSA private key import error:', error);
    throw error;
  }
}

/**
 * Import ECC public key from base64
 */
export async function importECCPublicKey(base64Key) {
  try {
    // Handle both base64 string and raw format
    let keyData;
    if (typeof base64Key === 'string') {
      keyData = base64ToArrayBuffer(base64Key);
    } else {
      keyData = base64Key;
    }
    
    return await window.crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      [] // Public key for ECDH should have no key usages
    );
  } catch (error) {
    console.error('ECC public key import error:', error);
    console.error('Key data type:', typeof base64Key);
    console.error('Key data length:', base64Key?.length);
    throw error;
  }
}

/**
 * Import ECC private key from base64
 */
export async function importECCPrivateKey(base64Key) {
  try {
    const keyData = base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveKey', 'deriveBits']
    );
  } catch (error) {
    console.error('ECC private key import error:', error);
    throw error;
  }
}

/**
 * Encrypt message with AES-256-GCM
 */
export async function encryptMessage(plaintext, key) {
  try {
    // Generate random IV (96 bits for GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const plaintextBuffer = stringToArrayBuffer(plaintext);
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      plaintextBuffer
    );

    // Extract auth tag (last 16 bytes)
    const encryptedArray = new Uint8Array(encrypted);
    const authTag = encryptedArray.slice(-16);
    const ciphertext = encryptedArray.slice(0, -16);

    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv),
      authTag: arrayBufferToBase64(authTag)
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

/**
 * Decrypt message with AES-256-GCM
 */
export async function decryptMessage(encryptedData, key) {
  try {
    const { ciphertext, iv, authTag } = encryptedData;

    // Reconstruct encrypted data with auth tag
    const ciphertextBuffer = base64ToArrayBuffer(ciphertext);
    const authTagBuffer = base64ToArrayBuffer(authTag);
    const ivBuffer = base64ToArrayBuffer(iv);

    // Combine ciphertext and auth tag
    const combined = new Uint8Array(ciphertextBuffer.byteLength + authTagBuffer.byteLength);
    combined.set(new Uint8Array(ciphertextBuffer), 0);
    combined.set(new Uint8Array(authTagBuffer), ciphertextBuffer.byteLength);

    // Decrypt
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      key,
      combined.buffer
    );

    return arrayBufferToString(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Decryption failed: Invalid key or corrupted data');
  }
}

/**
 * Generate AES-256 key for symmetric encryption
 */
export async function generateAESKey() {
  try {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('AES key generation error:', error);
    throw error;
  }
}

/**
 * Derive key using HKDF (HMAC-based Key Derivation Function)
 */
export async function deriveKey(sharedSecret, salt, info) {
  try {
    // Import shared secret
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveKey']
    );

    // Derive key
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt || new Uint8Array(0),
        info: info ? stringToArrayBuffer(info) : new Uint8Array(0)
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );

    return derivedKey;
  } catch (error) {
    console.error('Key derivation error:', error);
    throw error;
  }
}

/**
 * Perform ECDH key exchange
 */
export async function performECDH(myPrivateKey, theirPublicKey) {
  try {
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: theirPublicKey
      },
      myPrivateKey,
      256
    );

    return new Uint8Array(sharedSecret);
  } catch (error) {
    console.error('ECDH error:', error);
    throw error;
  }
}

/**
 * Sign data with RSA private key
 */
export async function signData(data, privateKey) {
  try {
    const dataBuffer = stringToArrayBuffer(data);
    
    // Import private key for signing
    const keyData = base64ToArrayBuffer(privateKey);
    const signingKey = await window.crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      signingKey,
      dataBuffer
    );

    return arrayBufferToBase64(signature);
  } catch (error) {
    console.error('Signing error:', error);
    throw error;
  }
}

/**
 * Verify signature with RSA public key
 */
export async function verifySignature(data, signature, publicKey) {
  try {
    const dataBuffer = stringToArrayBuffer(data);
    const signatureBuffer = base64ToArrayBuffer(signature);
    
    const keyData = base64ToArrayBuffer(publicKey);
    const verifyingKey = await window.crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['verify']
    );

    const isValid = await window.crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      verifyingKey,
      signatureBuffer,
      dataBuffer
    );

    return isValid;
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}

/**
 * Generate random nonce
 */
export function generateNonce() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return arrayBufferToBase64(array.buffer);
}

/**
 * Hash data using SHA-256
 */
export async function hashData(data) {
  try {
    const dataBuffer = stringToArrayBuffer(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    return arrayBufferToBase64(hashBuffer);
  } catch (error) {
    console.error('Hashing error:', error);
    throw error;
  }
}

