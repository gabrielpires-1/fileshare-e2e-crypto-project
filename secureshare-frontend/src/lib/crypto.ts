// src/lib/crypto.ts

// --- FUNÇÕES AUXILIARES ---
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function formatAsPEM(base64: string, type: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
  const chunks = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----\n`;
}

function pemToBinary(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----(BEGIN|END) (PUBLIC|PRIVATE) KEY-----/g, '').replace(/\s/g, '');
  const binary = window.atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}


// --- GERAÇÃO DE CHAVES ---
async function generateRsaKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([0x01, 0x00, 0x01]), hash: 'SHA-256' },
    true, ['encrypt', 'decrypt']
  );
  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  return {
    publicKey: formatAsPEM(arrayBufferToBase64(publicKeyBuffer), 'PUBLIC KEY'),
    privateKey: formatAsPEM(arrayBufferToBase64(privateKeyBuffer), 'PRIVATE KEY'),
  };
}

async function generateEcdsaKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, ['sign', 'verify']
  );
  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  return {
    publicKey: formatAsPEM(arrayBufferToBase64(publicKeyBuffer), 'PUBLIC KEY'),
    privateKey: formatAsPEM(arrayBufferToBase64(privateKeyBuffer), 'PRIVATE KEY'),
  };
}

export async function generateAllKeys() {
  const [encryptKeys, signKeys] = await Promise.all([
    generateRsaKeys(),
    generateEcdsaKeys(),
  ]);
  return { encryptKeys, signKeys };
}


// --- ARMAZENAMENTO DE CHAVES ---
export function saveKeysToLocalStorage(
  encryptPublicKey: string,
  encryptPrivateKey: string,
  signPublicKey: string,
  signPrivateKey: string
): void {
  try {
    localStorage.setItem('encryptPublicKey', encryptPublicKey);
    localStorage.setItem('encryptPrivateKey', encryptPrivateKey);
    localStorage.setItem('signPublicKey', signPublicKey);
    localStorage.setItem('signPrivateKey', signPrivateKey);
    console.log('Todos os 4 pares de chaves salvos no Local Storage.');
  } catch (e) { console.error("Falha ao salvar chaves", e); }
}

export function loadKeysFromLocalStorage(): {
  encryptKeys: { publicKey: string; privateKey: string };
  signKeys: { publicKey: string; privateKey: string };
} | null {
  try {
    const encryptPublicKey = localStorage.getItem('encryptPublicKey');
    const encryptPrivateKey = localStorage.getItem('encryptPrivateKey');
    const signPublicKey = localStorage.getItem('signPublicKey');
    const signPrivateKey = localStorage.getItem('signPrivateKey');
    if (!encryptPublicKey || !encryptPrivateKey || !signPublicKey || !signPrivateKey) return null;
    return {
      encryptKeys: { publicKey: encryptPublicKey, privateKey: encryptPrivateKey },
      signKeys: { publicKey: signPublicKey, privateKey: signPrivateKey },
    };
  } catch (e) { return null; }
}


// --- FUNÇÕES DE TOKEN ---
export function saveToken(token: string): void {
  try { localStorage.setItem('authToken', token); }
  catch (e) { console.error("Falha ao salvar token", e); }
}
export function getToken(): string | null {
  try { return localStorage.getItem('authToken'); }
  catch (e) { return null; }
}
export function clearAuthData(): void {
  try {
    localStorage.removeItem('authToken');
    localStorage.removeItem('encryptPublicKey');
    localStorage.removeItem('encryptPrivateKey');
    localStorage.removeItem('signPublicKey');
    localStorage.removeItem('signPrivateKey');
  } catch (e) { console.error("Falha ao limpar dados", e); }
}


// --- IMPORTAÇÃO DE CHAVES (PARA CRIPTOGRAFIA) ---
async function importEncryptPublicKey(pem: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey('spki', pemToBinary(pem), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
}
async function importSignPrivateKey(pem: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey('pkcs8', pemToBinary(pem), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
}
async function importEncryptPrivateKey(pem: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey('pkcs8', pemToBinary(pem), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
}
async function importVerifyPublicKey(pem: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey('spki', pemToBinary(pem), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
}


// --- FLUXO DE CRIPTOGRAFIA (UPLOAD) ---
export async function encryptFile(
  file: File,
  bobEncryptPublicKeyPEM: string,
  aliceSignPrivateKeyPEM: string
): Promise<{ encryptedFileBlob: Blob; skb_b64: string; sig_b64: string }> {

  // Passo 1: Gerar Chave Simétrica (SK) - AES-GCM
  const sk = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Passo 2: Criptografar o arquivo com SK
  const fileBuffer = await file.arrayBuffer();
  const encryptedFileBuffer = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, sk, fileBuffer);
  const ivAndEncryptedFile = new Uint8Array(iv.length + encryptedFileBuffer.byteLength);
  ivAndEncryptedFile.set(iv);
  ivAndEncryptedFile.set(new Uint8Array(encryptedFileBuffer), iv.length);
  const encryptedFileBlob = new Blob([ivAndEncryptedFile]);

  // Passo 3: Encapsular a SK com a Chave Pública de Bob (Gerar SKB)
  const bobEncryptPublicKey = await importEncryptPublicKey(bobEncryptPublicKeyPEM);
  const skExported = await window.crypto.subtle.exportKey('raw', sk);
  const skbBuffer = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, bobEncryptPublicKey, skExported);
  const skb_b64 = arrayBufferToBase64(skbBuffer);

  // Passo 4: Concatenar (File.enc + SKB) para assinatura
  const dataToSign = new Uint8Array(ivAndEncryptedFile.length + skbBuffer.byteLength);
  dataToSign.set(ivAndEncryptedFile);
  dataToSign.set(new Uint8Array(skbBuffer), ivAndEncryptedFile.length);

  // Passo 5: Assinar os dados com a Chave Privada de Alice (Gerar Sig)
  const aliceSignPrivateKey = await importSignPrivateKey(aliceSignPrivateKeyPEM);
  const signatureBuffer = await window.crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, aliceSignPrivateKey, dataToSign);
  const sig_b64 = arrayBufferToBase64(signatureBuffer);

  // Passo 6: Retornar dados
  return { encryptedFileBlob, skb_b64, sig_b64 };
}


// --- FLUXO DE DESCRIPTOGRAFIA (DOWNLOAD) ---
export async function decryptFile(
  encryptedFileBlob: Blob,
  skb_b64: string,
  sig_b64: string,
  bobEncryptPrivateKeyPEM: string, // Chave privada de Bob (local)
  aliceVerifyPublicKeyPEM: string  // Chave pública de Alice (da API)
): Promise<Blob> {

  // 1. Carregar chaves de Bob e Alice
  const bobEncryptPrivateKey = await importEncryptPrivateKey(bobEncryptPrivateKeyPEM);
  const aliceVerifyPublicKey = await importVerifyPublicKey(aliceVerifyPublicKeyPEM);

  // 2. Desencapsular o SKB (Passo 3 Inverso)
  const skbBuffer = pemToBinary(formatAsPEM(skb_b64, 'PRIVATE KEY')); // Hack
  const skExported = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, bobEncryptPrivateKey, skbBuffer);

  // 3. Verificar a Assinatura (Passo 4/5 Inverso)
  const encryptedFileBuffer = await encryptedFileBlob.arrayBuffer();
  const dataToVerify = new Uint8Array(encryptedFileBuffer.byteLength + skbBuffer.byteLength);
  dataToVerify.set(new Uint8Array(encryptedFileBuffer));
  dataToVerify.set(new Uint8Array(skbBuffer), encryptedFileBuffer.byteLength);
  
  const signatureBuffer = pemToBinary(formatAsPEM(sig_b64, 'PRIVATE KEY')); // Hack
  
  const isValid = await window.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    aliceVerifyPublicKey,
    signatureBuffer,
    dataToVerify
  );

  if (!isValid) {
    throw new Error("ASSINATURA INVÁLIDA! O arquivo pode ter sido adulterado.");
  }

  // 4. Re-importar a Chave Simétrica (SK)
  const sk = await window.crypto.subtle.importKey('raw', skExported, { name: 'AES-GCM' }, true, ['decrypt']);

  // 5. Separar o IV do arquivo (Passo 2 Inverso)
  const iv = encryptedFileBuffer.slice(0, 12);
  const encryptedData = encryptedFileBuffer.slice(12);

  // 6. Descriptografar
  const decryptedFileBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, sk, encryptedData);

  return new Blob([decryptedFileBuffer]);
}

export function readTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsText(file);
  });
}

/**
 * A MÁGICA: Importa uma chave privada (PEM) e exporta 
 * a chave pública (PEM) correspondente.
 */
async function getPublicKeyFromPrivateKey(
  privateKeyPem: string, 
  algorithm: 'RSA-OAEP' | 'ECDSA'
): Promise<string> {
  
  let cryptoKey: CryptoKey;
  
  // 1. Define os parâmetros de importação
  if (algorithm === 'RSA-OAEP') {
    cryptoKey = await window.crypto.subtle.importKey(
      'pkcs8',
      pemToBinary(privateKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true, // Chave deve ser 'extractable' para derivarmos a pública
      ['decrypt']
    );
  } else { // ECDSA
    cryptoKey = await window.crypto.subtle.importKey(
      'pkcs8',
      pemToBinary(privateKeyPem),
      { name: 'ECDSA', namedCurve: 'P-256' },
      true, // 'extractable'
      ['sign']
    );
  }

  // 2. Exporta a chave PÚBLICA (formato 'spki')
  const publicKeyBuffer = await window.crypto.subtle.exportKey(
    'spki',
    cryptoKey // O browser deriva a pública da privada
  );

  // 3. Formata como PEM e retorna
  return formatAsPEM(arrayBufferToBase64(publicKeyBuffer), 'PUBLIC KEY');
}

/**
 * Função principal de verificação.
 */
export async function verifyKeys(
  encryptPrivateKeyPem: string,
  signPrivateKeyPem: string,
  apiPublicKeys: { publicKey: string, publicKeySign: string }
): Promise<boolean> {
  try {
    // --- Teste 1: Verificar a Chave de Assinatura (ECDSA) ---
    // (Assina um 'challenge' com a chave privada e verifica com a pública)
    
    const signPrivateKey = await importSignPrivateKey(signPrivateKeyPem);
    const verifyPublicKey = await importVerifyPublicKey(apiPublicKeys.publicKeySign);
    
    const challengeSign = new TextEncoder().encode("challenge_for_ecdsa_key");

    const signature = await window.crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signPrivateKey,
      challengeSign
    );
    
    const isSignKeyValid = await window.crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyPublicKey,
      signature,
      challengeSign
    );

    if (!isSignKeyValid) {
      console.error("Falha na verificação da CHAVE DE ASSINATURA.");
      return false;
    }

    // --- Teste 2: Verificar a Chave de Criptografia (RSA-OAEP) ---
    // (Criptografa um 'challenge' com a chave pública e descriptografa com a privada)
    
    const encryptPublicKey = await importEncryptPublicKey(apiPublicKeys.publicKey);
    const encryptPrivateKey = await importEncryptPrivateKey(encryptPrivateKeyPem);

    const challengeEncrypt = new TextEncoder().encode("challenge_for_rsa_key");

    const encryptedChallenge = await window.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      encryptPublicKey,
      challengeEncrypt
    );

    const decryptedChallengeBuffer = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      encryptPrivateKey,
      encryptedChallenge
    );
    
    const decryptedChallenge = new TextDecoder().decode(decryptedChallengeBuffer);
    const isEncryptKeyValid = decryptedChallenge === "challenge_for_rsa_key";

    if (!isEncryptKeyValid) {
      console.error("Falha na verificação da CHAVE DE CRIPTOGRAFIA.");
      return false;
    }

    // 3. Se ambos os testes passaram
    return true;

  } catch (err) {
    // Isso vai capturar a 'DOMException' se o PEM estiver mal formatado
    console.error("Falha ao verificar chaves:", err); 
    return false;
  }
}