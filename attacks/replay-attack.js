/**
 * Replay Attack Demonstration Script
 * 
 * This script demonstrates replay attacks and how our system prevents them
 * using nonces, timestamps, and sequence numbers.
 * 
 * WARNING: This is for educational purposes only.
 */

const axios = require('axios');
const crypto = require('crypto');

const API_URL = 'http://localhost:5000/api';

/**
 * Scenario 1: Replay Attack WITHOUT Protection
 * 
 * Shows how an attacker can replay old messages if there's no protection
 */
async function demonstrateReplayWithoutProtection() {
  console.log('\n=== Replay Attack: WITHOUT Protection ===\n');

  console.log('1. Alice sends a message to Bob: "Transfer $1000"');
  const originalMessage = {
    senderId: 'alice',
    receiverId: 'bob',
    message: 'Transfer $1000',
    timestamp: new Date().toISOString()
  };

  console.log('   Message:', JSON.stringify(originalMessage, null, 2));

  console.log('\n2. Mallory intercepts and saves the message');

  console.log('\n3. Later, Mallory replays the same message');
  const replayedMessage = { ...originalMessage };
  console.log('   Replayed Message:', JSON.stringify(replayedMessage, null, 2));

  console.log('\n❌ VULNERABILITY: Without protection, replay attack succeeds!');
  console.log('   - Bob receives the message again');
  console.log('   - Bob might execute the action again (e.g., transfer money twice)');
  console.log('   - No way to detect that this is a duplicate message');
}

/**
 * Scenario 2: Replay Attack WITH Protection (Nonces)
 * 
 * Shows how nonces prevent replay attacks
 */
async function demonstrateReplayWithNonces() {
  console.log('\n=== Replay Attack Prevention: WITH Nonces ===\n');

  console.log('1. Alice sends a message with a unique nonce');
  const nonce1 = crypto.randomBytes(16).toString('base64');
  const message1 = {
    senderId: 'alice',
    receiverId: 'bob',
    message: 'Transfer $1000',
    nonce: nonce1,
    timestamp: new Date().toISOString()
  };

  console.log('   Message:', JSON.stringify({
    ...message1,
    nonce: message1.nonce.substring(0, 20) + '...'
  }, null, 2));

  console.log('\n2. Server stores the nonce in database');
  console.log('   Nonce stored:', nonce1.substring(0, 20) + '...');

  console.log('\n3. Mallory tries to replay the same message');
  const replayedMessage = { ...message1 };
  console.log('   Replayed Message (same nonce):', replayedMessage.nonce.substring(0, 20) + '...');

  console.log('\n4. Server checks if nonce already exists');
  console.log('   ✅ Nonce found in database - REJECTED!');
  console.log('   ❌ Replay attack detected and prevented');

  console.log('\n✅ PROTECTION: Nonces prevent replay attacks!');
  console.log('   - Each message has a unique nonce');
  console.log('   - Server stores all nonces');
  console.log('   - Duplicate nonces are rejected');
}

/**
 * Scenario 3: Replay Attack WITH Protection (Timestamps)
 * 
 * Shows how timestamps prevent replay attacks
 */
async function demonstrateReplayWithTimestamps() {
  console.log('\n=== Replay Attack Prevention: WITH Timestamps ===\n');

  console.log('1. Alice sends a message with timestamp');
  const message1 = {
    senderId: 'alice',
    receiverId: 'bob',
    message: 'Transfer $1000',
    timestamp: new Date().toISOString()
  };

  console.log('   Message timestamp:', message1.timestamp);

  console.log('\n2. Mallory intercepts and saves the message');

  console.log('\n3. 10 minutes later, Mallory tries to replay');
  const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const replayedMessage = {
    ...message1,
    timestamp: oldTimestamp
  };

  console.log('   Replayed message timestamp:', replayedMessage.timestamp);
  console.log('   Current time:', new Date().toISOString());

  console.log('\n4. Server checks timestamp');
  const timeDiff = Date.now() - new Date(oldTimestamp).getTime();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (timeDiff > maxAge) {
    console.log('   ✅ Message is too old - REJECTED!');
    console.log('   ❌ Replay attack detected and prevented');
  } else {
    console.log('   ⚠️  Message is recent - might be accepted');
  }

  console.log('\n✅ PROTECTION: Timestamps prevent old message replay!');
  console.log('   - Each message has a timestamp');
  console.log('   - Server rejects messages older than threshold (e.g., 5 minutes)');
  console.log('   - Old replayed messages are automatically rejected');
}

/**
 * Scenario 4: Replay Attack WITH Protection (Sequence Numbers)
 * 
 * Shows how sequence numbers prevent replay attacks
 */
async function demonstrateReplayWithSequenceNumbers() {
  console.log('\n=== Replay Attack Prevention: WITH Sequence Numbers ===\n');

  console.log('1. Alice sends messages with sequence numbers');
  const messages = [
    { seq: 1, message: 'Hello' },
    { seq: 2, message: 'How are you?' },
    { seq: 3, message: 'Transfer $1000' }
  ];

  console.log('   Messages sent:');
  messages.forEach(msg => {
    console.log(`   Sequence ${msg.seq}: ${msg.message}`);
  });

  console.log('\n2. Bob receives messages in order');
  console.log('   Last received sequence: 3');

  console.log('\n3. Mallory tries to replay sequence 2');
  const replayedMessage = { seq: 2, message: 'How are you?' };
  console.log('   Replayed message:', JSON.stringify(replayedMessage));

  console.log('\n4. Bob checks sequence number');
  const lastSeq = 3;
  if (replayedMessage.seq <= lastSeq) {
    console.log('   ✅ Sequence number already processed - REJECTED!');
    console.log('   ❌ Replay attack detected and prevented');
  } else {
    console.log('   ⚠️  Sequence number is new - might be accepted');
  }

  console.log('\n✅ PROTECTION: Sequence numbers prevent replay attacks!');
  console.log('   - Each message has an incrementing sequence number');
  console.log('   - Recipients track the last received sequence number');
  console.log('   - Messages with old sequence numbers are rejected');
}

/**
 * Run all demonstrations
 */
async function runDemonstrations() {
  console.log('='.repeat(60));
  console.log('REPLAY ATTACK DEMONSTRATION');
  console.log('='.repeat(60));

  await demonstrateReplayWithoutProtection();
  console.log('\n' + '='.repeat(60));
  await demonstrateReplayWithNonces();
  console.log('\n' + '='.repeat(60));
  await demonstrateReplayWithTimestamps();
  console.log('\n' + '='.repeat(60));
  await demonstrateReplayWithSequenceNumbers();

  console.log('\n' + '='.repeat(60));
  console.log('CONCLUSION:');
  console.log('Our system uses ALL THREE protections:');
  console.log('1. Nonces (unique per message)');
  console.log('2. Timestamps (reject old messages)');
  console.log('3. Sequence numbers (reject out-of-order messages)');
  console.log('This multi-layered approach provides strong replay attack protection.');
  console.log('='.repeat(60));
}

// Run if executed directly
if (require.main === module) {
  runDemonstrations().catch(console.error);
}

module.exports = {
  demonstrateReplayWithoutProtection,
  demonstrateReplayWithNonces,
  demonstrateReplayWithTimestamps,
  demonstrateReplayWithSequenceNumbers,
  runDemonstrations
};

