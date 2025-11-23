# SecureShare E2E

**SecureShare E2E** is a secure file sharing application built on the principle of **End-to-End Encryption (E2E)**.

In traditional file sharing services, the server provider has access to your files (even if they are encrypted at rest, the server holds the keys). SecureShare solves this privacy gap. In this architecture, **the server acts only as a facilitator** for metadata and storage but remains cryptographically "blind" to the actual file contents.

That is, the server never stores **private keys**. It just stores the **public keys**.

Only the intended recipient possesses the private key required to decrypt the file. **Not even the system administrators can view the data.**

---

## 📁 Project Overview

* **Goal:** Enable users to share files securely over an untrusted network.
* **Core Security Principle:** The backend never touches the plaintext file or the private encryption keys. All cryptographic operations (Key Generation, Encryption, Decryption, Signing) happen client-side (in the browser).
* **Infrastructure:**
    * **Storage:** AWS S3 (Private Bucket).
    * **Database:** PostgreSQL (Stores User Metadata & Public Keys).
    * **API:** Go (Golang).
    * **Client:** Next.js (React).

---

## 🔐 Security Flows

The application relies on a dual-key architecture for every user:
1.  **Encryption Key Pair (RSA-OAEP 2048-bit):** Used to ensure confidentiality (only the recipient can read).
2.  **Signing Key Pair (ECDSA P-256):** Used to ensure authenticity (proof that the file came from the sender).

### 1. Registration Flow (Onboarding)
When a new user creates an account, the browser acts as a Certificate Authority for itself.

1.  **Key Generation:** The browser generates two key pairs using the Web Crypto API.
2.  **Public Key Upload:** The user sends their **Public Keys** (PEM format) along with their username and password to the Backend.
3.  **Private Key Download:** The **Private Keys** are NEVER sent to the server. Instead, the browser forces a download of `.pem` files to the user's machine.
    * *Security Note:* If the user loses these files, the account is lost forever. The server cannot recover them.

### 2. Login Flow (Authentication & Key Verification)
Login is a two-step process to ensure the user actually owns the identity they claim.

1.  **Credential Check:** User sends `username` + `password`. Server validates the hash and returns a temporary **JWT**.
2.  **Key Verification (Challenge-Response):**
    * The user must upload their `.pem` Private Keys to the browser.
    * The browser fetches the stored Public Keys from the API.
    * **The Test:** The browser cryptographically verifies that the uploaded Private Keys mathematically correspond to the Public Keys stored on the server (using a Challenge-Response mechanism).
    * *Only if this check passes*, the keys are loaded into the session memory for use.

### 3. Sending a File (Alice -> Bob)
This flow ensures confidentiality (via Hybrid Encryption) and integrity.

1.  **Input:** Alice selects a file and chooses "Bob" as the recipient.
2.  **Symmetric Encryption:** The browser generates a one-time **Symmetric Key (SK)** (AES-GCM 256-bit) and encrypts the file.
3.  **Key Encapsulation:** The browser fetches Bob's **RSA Public Key**. It encrypts the `SK` using Bob's key. The result is the **SKB** (Symmetric Key Boxed).
4.  **Signing:** The browser calculates a hash of the encrypted data and signs it using Alice's **ECDSA Private Key**. The result is the **Sig** (Signature).
5.  **Direct Upload:** The Backend generates an AWS S3 **Presigned PUT URL**. Alice's browser uploads the encrypted blob directly to S3 (bypassing the backend).
6.  **Metadata Sync:** Alice sends the metadata (`SKB`, `Sig`, and S3 Reference) to the Backend database.

### 4. Receiving & Downloading (Bob <- Alice)
This flow ensures the file hasn't been tampered with and was indeed sent by Alice.

1.  **Notification:** Bob sees a pending transfer from Alice in the dashboard.
2.  **Direct Download:** Bob requests the file. The Backend generates an AWS S3 **Presigned GET URL**. Bob's browser downloads the encrypted blob.
3.  **Decapsulation:** Bob uses his **RSA Private Key** to decrypt the `SKB`. This reveals the symmetric `SK`.
4.  **Verification:** Bob fetches Alice's **ECDSA Public Key**. The browser verifies the `Sig` against the file data.
    * *If verification fails:* The file was tampered with or didn't come from Alice.
    * *If verification passes:* The process continues.
5.  **Decryption:** The browser uses the `SK` to decrypt the file content and triggers a download to Bob's disk.

---

## 🏗️ Architecture Overview

### Frontend (Next.js + TypeScript)
The "Brain" of the security operations.
* **Responsibilities:**
    * Key Generation & Management (`window.crypto`).
    * Hybrid Encryption/Decryption logic.
    * Interacting with AWS S3 via Presigned URLs.
    * Validating cryptographic challenges during login.
* **Key Tech:** React Hooks, Web Crypto API, TailwindCSS.

### Backend (Go + Chi)
The "Facilitator" and Trust Anchor.
* **Responsibilities:**
    * **Identity Provider:** Stores Users and their *Public* Keys.
    * **Metadata Store:** Tracks transfers (Who sent what to whom, but not *what* is inside).
    * **S3 Orchestrator:** Generates secure, time-limited Presigned URLs for uploads and downloads so the frontend can interact with the cloud storage securely.
    * **Stateless:** Uses JWT for API authentication.
* **Key Tech:** Go (Golang), Chi Router, pgx (PostgreSQL driver), AWS SDK v2.

---

## 🚀 How to Run

### Prerequisites
* Docker & Docker Compose
* Go 1.23+
* Node.js 18+
* AWS Account (S3 Bucket credentials)

### 1. Infrastructure (Database)
```bash
cd secureshare-backend
docker compose up -d
```

### 2. Backend (Go)
Create a .env file based on your configuration and run:
```bash
cd secureshare-backend
go run ./cmd/server/main.go
```

### 3. Frontend (Next.js)
Create a .env.local file pointing to the API and run:
```bash
cd secureshare-frontend
npm install
npm run dev
```

Access http://localhost:3000 to start.