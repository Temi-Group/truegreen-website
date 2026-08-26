/* ===========================================================
   Lifetime Truegreen — dashboard config crypto
   -----------------------------------------------------------
   Shared by the browser (login.html) and the CLI tool
   (scripts/set-dashboard-url.mjs) so the two can never drift.

   The Claude artifact URL is never stored in plaintext in the
   repo. It is encrypted with AES-256-GCM under a key derived
   from the shared client password via PBKDF2-SHA256.

   GCM's authentication tag doubles as the password check: if
   decryption succeeds the password was correct, so we do not
   store a separate password hash.
   =========================================================== */

export const FORMAT_VERSION = 1;
export const KDF_ITERATIONS = 310000;   // OWASP 2023 guidance for PBKDF2-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;                    // 96-bit nonce, the GCM standard

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt any text into the payload written to data/*.json.
 *
 * Used two ways:
 *   mode 'url'     — the payload holds a dashboard link
 *   mode 'content' — the payload holds a whole self-contained HTML page,
 *                    so the dashboard is served from truegreen.co.za and no
 *                    third-party page or link is ever exposed to the viewer
 *
 * @param {string} text      the plaintext to protect
 * @param {string} password  the shared portal password
 * @param {object} [extra]   plaintext metadata to merge in (updatedAt, mode)
 */
export async function encryptText(text, password, extra) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, KDF_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv }, key, encoder.encode(text)
  );
  return Object.assign({
    v: FORMAT_VERSION,
    configured: true,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    alg: 'AES-GCM',
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  }, extra || {});
}

/**
 * Decrypt a payload. Throws if the password is wrong or the blob is damaged.
 * @param {object} payload   parsed config JSON
 * @param {string} password  the shared portal password
 * @returns {Promise<string>} the plaintext (a URL or a whole HTML page)
 */
export async function decryptText(payload, password) {
  if (!payload || payload.configured === false || !payload.ciphertext) {
    throw new Error('NOT_CONFIGURED');
  }
  if (payload.v !== FORMAT_VERSION) {
    throw new Error('UNSUPPORTED_VERSION');
  }
  const key = await deriveKey(
    password,
    fromBase64(payload.salt),
    payload.iterations || KDF_ITERATIONS
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.ciphertext)
  );
  return decoder.decode(plaintext);
}

/* Backwards-compatible aliases from when the payload only ever held a URL. */
export const encryptUrl = encryptText;
export const decryptUrl = decryptText;
