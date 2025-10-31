// src/lib/crypto.ts

// --- FUNÇÕES AUXILIARES ---
// (arrayBufferToBase64 e formatAsPEM não mudam)
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

// --- GERAÇÃO DE CHAVE (ÚNICA) ---
/**
 * Gera um par de chaves RSA-OAEP 2048-bit (para Criptografia)
 */
export async function generateRsaKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
  
  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: formatAsPEM(arrayBufferToBase64(publicKeyBuffer), 'PUBLIC KEY'),
    privateKey: formatAsPEM(arrayBufferToBase64(privateKeyBuffer), 'PRIVATE KEY'),
  };
}

// --- ARMAZENAMENTO (SIMPLES) ---
export function saveKeysToLocalStorage(publicKey: string, privateKey: string): void {
  try {
    localStorage.setItem('publicKey', publicKey);
    localStorage.setItem('privateKey', privateKey);
    console.log('Chaves (RSA) salvas no Local Storage.');
  } catch (error) {
    console.error("Falha ao salvar chaves:", error);
  }
}

export function loadKeysFromLocalStorage(): { publicKey: string; privateKey: string } | null {
  try {
    const publicKey = localStorage.getItem('publicKey');
    const privateKey = localStorage.getItem('privateKey');
    if (!publicKey || !privateKey) return null;
    return { publicKey, privateKey };
  } catch (error) {
    return null;
  }
}

// --- Funções de Auth (Token) ---
export function saveToken(token: string): void {
  try { localStorage.setItem('authToken', token); }
  catch (error) { console.error("Falha ao salvar token:", error); }
}

export function getToken(): string | null {
  try { return localStorage.getItem('authToken'); }
  catch (error) { return null; }
}

export function clearAuthData(): void {
  try {
    localStorage.removeItem('authToken');
    localStorage.removeItem('publicKey');
    localStorage.removeItem('privateKey');
  } catch (error) {
    console.error("Falha ao limpar dados:", error);
  }
}

// --- FUNÇÕES DE IMPORTAÇÃO DE CHAVES ---
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
// Importa a Chave Pública de Criptografia (RSA-OAEP) de Bob
async function importEncryptPublicKey(pem: string): Promise<CryptoKey> {
  const binary = pemToBinary(pem);
  return window.crypto.subtle.importKey(
    'spki', // Formato de chave pública
    binary,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

// --- FLUXO DE CRIPTOGRAFIA (SIMPLIFICADO) ---
/**
 * Fluxo de criptografia SEM assinatura (Passos 1-3)
 */
export async function encryptFile(
  file: File,
  bobEncryptPublicKeyPEM: string
): Promise<{ encryptedFileBlob: Blob; skb_b64: string }> {

  // Passo 1: Gerar Chave Simétrica (SK) - AES-GCM
  const sk = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Passo 2: Criptografar o arquivo (File) com SK
  const fileBuffer = await file.arrayBuffer();
  const encryptedFileBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    sk,
    fileBuffer
  );
  const ivAndEncryptedFile = new Uint8Array(iv.length + encryptedFileBuffer.byteLength);
  ivAndEncryptedFile.set(iv);
  ivAndEncryptedFile.set(new Uint8Array(encryptedFileBuffer), iv.length);
  const encryptedFileBlob = new Blob([ivAndEncryptedFile]);

  // Passo 3: Encapsular a SK com a Chave Pública de Bob (Gerar SKB)
  const bobEncryptPublicKey = await importEncryptPublicKey(bobEncryptPublicKeyPEM);
  const skExported = await window.crypto.subtle.exportKey('raw', sk);
  
  const skbBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    bobEncryptPublicKey,
    skExported
  );
  const skb_b64 = arrayBufferToBase64(skbBuffer);

  // Passos 4-6 (Assinatura) REMOVIDOS
  
  return {
    encryptedFileBlob, // O arquivo para S3
    skb_b64,           // Metadados
  };
}

// NOVO: Importa a Chave Privada de Criptografia (RSA-OAEP) de Bob
async function importEncryptPrivateKey(pem: string): Promise<CryptoKey> {
  const binary = pemToBinary(pem);
  return window.crypto.subtle.importKey(
    'pkcs8', // Formato de chave privada
    binary,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt'] // Propósito: descriptografar
  );
}

// --- FUNÇÃO DE DESCRIPTOGRAFIA (OPOSTO DO PASSO 1-3) ---

/**
 * Descriptografa um arquivo, dado o Blob do S3 e o SKB
 */
export async function decryptFile(
  encryptedFileBlob: Blob,
  skb_b64: string,
  bobEncryptPrivateKeyPEM: string // Chave privada de Bob (do localStorage)
): Promise<Blob> {

  // 1. Carregar a chave privada de Bob
  const bobEncryptPrivateKey = await importEncryptPrivateKey(bobEncryptPrivateKeyPEM);

  // 2. Desencapsular o SKB (Passo 3 Inverso)
  const skbBuffer = pemToBinary(formatAsPEM(skb_b64, 'PRIVATE KEY')); // Hacky, mas ok
  const skExported = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    bobEncryptPrivateKey,
    skbBuffer
  );

  // 3. Re-importar a Chave Simétrica (SK)
  const sk = await window.crypto.subtle.importKey(
    'raw',
    skExported,
    { name: 'AES-GCM' },
    true,
    ['decrypt']
  );

  // 4. Separar o IV do arquivo (Passo 2 Inverso)
  const encryptedFileBuffer = await encryptedFileBlob.arrayBuffer();
  const iv = encryptedFileBuffer.slice(0, 12); // Pegamos os 12 bytes do IV
  const encryptedData = encryptedFileBuffer.slice(12); // O resto são os dados

  // 5. Descriptografar o arquivo com a SK
  const decryptedFileBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    sk,
    encryptedData
  );

  // 6. Retornar o arquivo como um Blob
  return new Blob([decryptedFileBuffer]);
}