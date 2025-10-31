package repository

import (
	"context"

	"secureshare-backend/internal/models"

	"github.com/google/uuid"
)

// UserStore define a interface para operações de usuário no DB
type UserStore interface {
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	GetAllUsers(ctx context.Context) ([]*models.User, error)
}

// TransferStore define a interface para operações de transferência no DB
type TransferStore interface {
	CreateTransfer(ctx context.Context, transfer *models.Transfer) error
	GetTransfersByDestUserID(ctx context.Context, destUserID uuid.UUID) ([]*models.Transfer, error)
}

// Store é uma interface agregada para todas as operações de store
// Facilita a injeção de dependência
type Store interface {
	UserStore
	TransferStore
}
