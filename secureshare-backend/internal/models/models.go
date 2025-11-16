package models

import (
	"time"

	"github.com/google/uuid"
)

// User representa um usuário no sistema
type User struct {
	ID            uuid.UUID `json:"id"`
	Username      string    `json:"username"`
	PasswordHash  string    `json:"-"` // Nunca expor em JSON
	PublicKey     string    `json:"publicKey"`
	PublicKeySign string    `json:"publicKeySign"`
	CreatedAt     time.Time `json:"createdAt"`
}

// Transfer representa os metadados de uma transferência de arquivo
type Transfer struct {
	ID            uuid.UUID `json:"id"`
	SourceUserID  uuid.UUID `json:"sourceUserId"`
	DestUserID    uuid.UUID `json:"destUserId"`
	LinkToEncFile string    `json:"linkToEncFile"`
	SKB           string    `json:"skb"` // Chave Simétrica Encapsulada (Symmetric Key Boxed)
	Sig           string    `json:"sig"`
	CreatedAt     time.Time `json:"createdAt"`
}
