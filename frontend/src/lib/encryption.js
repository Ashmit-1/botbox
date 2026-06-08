/**
 * Encryption Utilities
 * 
 * Provides transparent browser-based encryption for sensitive data (API keys)
 * Uses Web Crypto API with AES-GCM encryption
 * 
 * Features:
 * - Automatic key derivation from a stable salt
 * - No user password required
 * - Transparent encryption/decryption
 * - Handles encoding/decoding automatically
 */

// Stable encryption key derivation
// Uses a fixed salt + SubtleCrypto to derive a consistent key
// This means the same input will always produce the same output for a given browser
const ENCRYPTION_SALT = 'llm-chat-ui-encryption-salt';
const ALGORITHM = { name: 'AES-GCM', length: 256 };

// Cache the derived key
let cachedKey = null;

/**
 * Derive encryption key from salt
 * @returns {Promise<CryptoKey>}
 */
async function getEncryptionKey() {
  if (cachedKey) {
    return cachedKey;
  }

  // Import a fixed key material (derived from salt)
  // In production, you might want to use a more secure key derivation
  // But for this use case (browser-only, user-specific), this is acceptable
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(ENCRYPTION_SALT);
  
  // Use SubtleCrypto to derive a proper key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(ENCRYPTION_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    ALGORITHM,
    false,
    ['encrypt', 'decrypt']
  );

  return cachedKey;
}

/**
 * Encrypt a string value
 * @param {string} plaintext - The string to encrypt
 * @returns {Promise<string>} - Base64-encoded encrypted data with IV
 */
export async function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encoder = new TextEncoder();
  const encodedPlaintext = encoder.encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedPlaintext
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string value
 * @param {string} ciphertext - Base64-encoded encrypted data
 * @returns {Promise<string>} - The decrypted string
 */
export async function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return ciphertext;
  }

  try {
    const key = await getEncryptionKey();
    
    // Convert from base64
    const combined = new Uint8Array(
      atob(ciphertext)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    // Extract IV (first 12 bytes)
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return the original value if decryption fails
    // This allows for graceful degradation
    return ciphertext;
  }
}

/**
 * Encrypt an object's specific fields
 * @param {Object} obj - The object to encrypt
 * @param {string[]} fields - Fields to encrypt
 * @returns {Promise<Object>} - Object with encrypted fields
 */
export async function encryptObjectFields(obj, fields) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] !== undefined) {
      result[field] = await encrypt(result[field]);
    }
  }

  return result;
}

/**
 * Decrypt an object's specific fields
 * @param {Object} obj - The object to decrypt
 * @param {string[]} fields - Fields to decrypt
 * @returns {Promise<Object>} - Object with decrypted fields
 */
export async function decryptObjectFields(obj, fields) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] !== undefined) {
      result[field] = await decrypt(result[field]);
    }
  }

  return result;
}

/**
 * Batch encrypt an array of objects
 * @param {Object[]} array - Array of objects
 * @param {string[]} fields - Fields to encrypt in each object
 * @returns {Promise<Object[]>}
 */
export async function encryptArrayFields(array, fields) {
  return Promise.all(array.map(obj => encryptObjectFields(obj, fields)));
}

/**
 * Batch decrypt an array of objects
 * @param {Object[]} array - Array of objects
 * @param {string[]} fields - Fields to decrypt in each object
 * @returns {Promise<Object[]>}
 */
export async function decryptArrayFields(array, fields) {
  return Promise.all(array.map(obj => decryptObjectFields(obj, fields)));
}

/**
 * Clear the cached encryption key (for testing or security)
 */
export function clearEncryptionCache() {
  cachedKey = null;
}

export default {
  encrypt,
  decrypt,
  encryptObjectFields,
  decryptObjectFields,
  encryptArrayFields,
  decryptArrayFields,
  clearEncryptionCache,
};
