package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"secureshare-backend/internal/models"
	"secureshare-backend/internal/repository"

	"github.com/google/uuid"
)

// TransferService lida com a lógica de negócios de transferências
type TransferService struct {
	store repository.Store // Precisa de UserStore e TransferStore
}

// NewTransferService cria um novo serviço de transferência
func NewTransferService(store repository.Store) *TransferService {
	return &TransferService{
		store: store,
	}
}

// CreateTransferRequest define os parâmetros para criar uma transferência
type CreateTransferRequest struct {
	DestUsername  string `json:"destUser"`
	LinkToEncFile string `json:"linkToEncFile"`
	SKB           string `json:"skb"`
	Sig           string `json:"sig"`
}

// CreateTransfer registra os metadados de uma nova transferência
func (s *TransferService) CreateTransfer(ctx context.Context, sourceUserID uuid.UUID, req CreateTransferRequest) (*models.Transfer, error) {
	// 1. Encontrar o usuário de destino
	destUser, err := s.store.GetUserByUsername(ctx, req.DestUsername)
	if err != nil {
		return nil, fmt.Errorf("usuário de destino '%s' não encontrado", req.DestUsername)
	}

	// 2. Criar o modelo de transferência
	transfer := &models.Transfer{
		ID:            uuid.New(),
		SourceUserID:  sourceUserID,
		DestUserID:    destUser.ID,
		LinkToEncFile: req.LinkToEncFile,
		SKB:           req.SKB,
		Sig:           req.Sig,
		CreatedAt:     time.Now(),
	}

	// 3. Salvar no repositório
	if err := s.store.CreateTransfer(ctx, transfer); err != nil {
		log.Printf("Erro ao salvar transferência no store: %v", err)
		return nil, fmt.Errorf("erro interno ao salvar transferência")
	}

	return transfer, nil
}

// GetPendingTransfers lista todas as transferências para um usuário
func (s *TransferService) GetPendingTransfers(ctx context.Context, destUserID uuid.UUID) ([]*models.Transfer, error) {
	transfers, err := s.store.GetTransfersByDestUserID(ctx, destUserID)
	if err != nil {
		log.Printf("Erro ao buscar transferências no store: %v", err)
		return nil, fmt.Errorf("erro interno ao buscar transferências")
	}
	return transfers, nil
}
