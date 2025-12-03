/**
 * MITM Attack Demonstration Script
 * 
 * This script demonstrates how a Man-in-the-Middle attack can intercept
 * and modify key exchange messages when digital signatures are not properly verified.
 * 
 * WARNING: This is for educational purposes only. Do not use for malicious purposes.
 */

const axios = require('axios');
const crypto = require('crypto');

const API_URL = 'http://localhost:5000/api';

/**
 * Scenario 1: MITM Attack WITHOUT Digital Signatures
 * 
 * In this scenario, we simulate what happens when:
 * 1. Alice initiates key exchange with Bob
 * 2. Mallory (attacker) intercepts the messages
 * 3. Mallory replaces public keys with her own
 * 4. Both Alice and Bob think they're communicating with each other,
 *    but they're actually communicating with Mallory
 */
async function demonstrateMITMWithoutSignatures() {
  console.log('\n=== MITM Attack Demonstration: WITHOUT Digital Signatures ===\n');

  // Simulate Alice's key exchange initiation
  console.log('1. Alice initiates key exchange with Bob');
  const aliceECDH = crypto.createECDH('prime256v1');
  aliceECDH.generateKeys();
  const alicePublicKey = aliceECDH.getPublicKey('base64');

  console.log('   Alice\'s ECDH Public Key:', alicePublicKey.substring(0, 50) + '...');

  // Mallory intercepts and replaces with her own key
  console.log('\n2. [MITM] Mallory intercepts Alice\'s message');
  const malloryECDH = crypto.createECDH('prime256v1');
  malloryECDH.generateKeys();
  const malloryPublicKey = malloryECDH.getPublicKey('base64');

  console.log('   Mallory replaces Alice\'s key with her own');
  console.log('   Mallory\'s Public Key:', malloryPublicKey.substring(0, 50) + '...');

  // Bob receives Mallory's key (thinking it's from Alice)
  console.log('\n3. Bob receives what he thinks is Alice\'s key');
  const bobECDH = crypto.createECDH('prime256v1');
  bobECDH.generateKeys();
  const bobPublicKey = bobECDH.getPublicKey('base64');

  // Bob sends his key back
  console.log('   Bob sends his public key:', bobPublicKey.substring(0, 50) + '...');

  // Mallory intercepts Bob's key and replaces it
  console.log('\n4. [MITM] Mallory intercepts Bob\'s key and replaces it');
  const malloryPublicKey2 = malloryECDH.getPublicKey('base64');
  console.log('   Mallory sends her key to Alice (pretending to be Bob)');

  // Now both parties derive keys with Mallory
  const aliceSharedSecret = aliceECDH.computeSecret(malloryPublicKey2, 'base64');
  const bobSharedSecret = bobECDH.computeSecret(malloryPublicKey, 'base64');
  const mallorySecret1 = malloryECDH.computeSecret(aliceECDH.getPublicKey(), 'base64');
  const mallorySecret2 = malloryECDH.computeSecret(bobECDH.getPublicKey(), 'base64');

  console.log('\n5. Key Derivation Results:');
  console.log('   Alice derives secret with Mallory:', aliceSharedSecret.toString('hex').substring(0, 32) + '...');
  console.log('   Bob derives secret with Mallory:', bobSharedSecret.toString('hex').substring(0, 32) + '...');
  console.log('   Mallory can decrypt ALL messages between Alice and Bob!');

  console.log('\n❌ VULNERABILITY: Without digital signatures, MITM attack succeeds!');
  console.log('   - Alice thinks she\'s talking to Bob, but is talking to Mallory');
  console.log('   - Bob thinks he\'s talking to Alice, but is talking to Mallory');
  console.log('   - Mallory can read and modify all messages');
}

/**
 * Scenario 2: MITM Attack WITH Digital Signatures (Prevented)
 * 
 * In this scenario, we show how digital signatures prevent MITM attacks:
 * 1. Alice signs her public key with her RSA private key
 * 2. Bob verifies the signature using Alice's RSA public key
 * 3. If Mallory tries to replace the key, the signature won't verify
 * 4. The attack is detected and prevented
 */
async function demonstrateMITMWithSignatures() {
  console.log('\n=== MITM Attack Prevention: WITH Digital Signatures ===\n');

  // Generate RSA key pairs for signing
  const aliceRSA = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const bobRSA = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const malloryRSA = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Alice's legitimate key exchange
  console.log('1. Alice initiates key exchange with digital signature');
  const aliceECDH = crypto.createECDH('prime256v1');
  aliceECDH.generateKeys();
  const alicePublicKey = aliceECDH.getPublicKey('base64');

  const messageToSign = `bob:${alicePublicKey}:${Date.now()}`;
  const aliceSignature = crypto.sign('SHA256', Buffer.from(messageToSign), {
    key: aliceRSA.privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
  });

  console.log('   Alice\'s ECDH Public Key:', alicePublicKey.substring(0, 50) + '...');
  console.log('   Alice\'s Digital Signature:', aliceSignature.toString('base64').substring(0, 50) + '...');

  // Bob verifies the signature
  console.log('\n2. Bob verifies Alice\'s signature');
  const isValid = crypto.verify('SHA256', Buffer.from(messageToSign), {
    key: aliceRSA.publicKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }, aliceSignature);

  if (isValid) {
    console.log('   ✅ Signature is VALID - Alice\'s identity confirmed');
  } else {
    console.log('   ❌ Signature is INVALID - Possible MITM attack!');
  }

  // Mallory tries to intercept
  console.log('\n3. [MITM] Mallory tries to replace Alice\'s key');
  const malloryECDH = crypto.createECDH('prime256v1');
  malloryECDH.generateKeys();
  const malloryPublicKey = malloryECDH.getPublicKey('base64');

  // Mallory tries to sign with her own key (but Bob has Alice's public key)
  const malloryMessage = `bob:${malloryPublicKey}:${Date.now()}`;
  const mallorySignature = crypto.sign('SHA256', Buffer.from(malloryMessage), {
    key: malloryRSA.privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
  });

  console.log('   Mallory sends her key with her own signature');

  // Bob verifies with Alice's public key (should fail)
  console.log('\n4. Bob verifies the signature with Alice\'s public key');
  const isMalloryValid = crypto.verify('SHA256', Buffer.from(malloryMessage), {
    key: aliceRSA.publicKey, // Bob uses Alice's public key
    padding: crypto.constants.RSA_PKCS1_PADDING
  }, mallorySignature);

  if (isMalloryValid) {
    console.log('   ❌ VULNERABILITY: Signature verification passed (should not happen)');
  } else {
    console.log('   ✅ Signature verification FAILED - MITM attack detected and prevented!');
    console.log('   Bob rejects the message and alerts Alice');
  }

  console.log('\n✅ PROTECTION: Digital signatures prevent MITM attacks!');
  console.log('   - Each party signs their public key with their RSA private key');
  console.log('   - Recipients verify signatures using the sender\'s RSA public key');
  console.log('   - If Mallory tries to replace keys, signature verification fails');
  console.log('   - Attack is detected and prevented');
}

/**
 * Run both demonstrations
 */
async function runDemonstrations() {
  console.log('='.repeat(60));
  console.log('MITM ATTACK DEMONSTRATION');
  console.log('='.repeat(60));

  await demonstrateMITMWithoutSignatures();
  console.log('\n' + '='.repeat(60));
  await demonstrateMITMWithSignatures();

  console.log('\n' + '='.repeat(60));
  console.log('CONCLUSION:');
  console.log('Digital signatures are essential for preventing MITM attacks');
  console.log('in key exchange protocols. Always verify signatures!');
  console.log('='.repeat(60));
}

// Run if executed directly
if (require.main === module) {
  runDemonstrations().catch(console.error);
}

module.exports = {
  demonstrateMITMWithoutSignatures,
  demonstrateMITMWithSignatures,
  runDemonstrations
};

