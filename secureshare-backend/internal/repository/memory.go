package repository

import (
	"context"
	"fmt"
	"sync"

	"secureshare-backend/internal/models"

	"github.com/google/uuid"
)

// InMemoryStore é uma implementação em-memória da interface Store
type InMemoryStore struct {
	mu                sync.RWMutex
	usersByID         map[uuid.UUID]*models.User
	usersByUsername   map[string]*models.User
	transfersByDestID map[uuid.UUID][]*models.Transfer
}

// NewInMemoryStore cria uma nova instância do store em memória
func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		usersByID:         make(map[uuid.UUID]*models.User),
		usersByUsername:   make(map[string]*models.User),
		transfersByDestID: make(map[uuid.UUID][]*models.Transfer),
	}
}

// --- UserStore ---

func (s *InMemoryStore) CreateUser(ctx context.Context, user *models.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.usersByUsername[user.Username]; exists {
		return fmt.Errorf("usuário '%s' já existe", user.Username)
	}

	s.usersByID[user.ID] = user
	s.usersByUsername[user.Username] = user
	return nil
}

func (s *InMemoryStore) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.usersByUsername[username]
	if !exists {
		return nil, fmt.Errorf("usuário '%s' não encontrado", username)
	}
	return user, nil
}

func (s *InMemoryStore) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.usersByID[id]
	if !exists {
		return nil, fmt.Errorf("usuário com ID '%s' não encontrado", id)
	}
	return user, nil
}

// --- TransferStore ---

func (s *InMemoryStore) CreateTransfer(ctx context.Context, transfer *models.Transfer) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.transfersByDestID[transfer.DestUserID] = append(s.transfersByDestID[transfer.DestUserID], transfer)
	return nil
}

func (s *InMemoryStore) GetTransfersByDestUserID(ctx context.Context, destUserID uuid.UUID) ([]*models.Transfer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	transfers := s.transfersByDestID[destUserID]
	if transfers == nil {
		// Retorna lista vazia em vez de nil, para consistência
		return []*models.Transfer{}, nil
	}
	return transfers, nil
}
