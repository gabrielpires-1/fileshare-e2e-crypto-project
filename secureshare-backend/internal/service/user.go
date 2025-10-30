package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"secureshare-backend/internal/auth"
	"secureshare-backend/internal/models"
	"secureshare-backend/internal/repository"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// UserService lida com a lógica de negócios de usuários
type UserService struct {
	store        repository.UserStore
	tokenService *auth.TokenService
}

// NewUserService cria um novo serviço de usuário
func NewUserService(store repository.UserStore, tokenService *auth.TokenService) *UserService {
	return &UserService{
		store:        store,
		tokenService: tokenService,
	}
}

// Register cria um novo usuário
func (s *UserService) Register(ctx context.Context, username, password, publicKey string) (*models.User, error) {
	// Validação (simples, pode ser melhorada com 'validator')
	if username == "" || password == "" || publicKey == "" {
		return nil, fmt.Errorf("username, password e publicKey são obrigatórios")
	}

	// Verificar se usuário já existe
	if _, err := s.store.GetUserByUsername(ctx, username); err == nil {
		return nil, fmt.Errorf("usuário '%s' já existe", username)
	}

	// Gerar hash da senha (nunca armazene senha em texto plano)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Erro ao gerar hash bcrypt: %v", err)
		return nil, fmt.Errorf("erro interno ao processar senha")
	}

	user := &models.User{
		ID:           uuid.New(),
		Username:     username,
		PasswordHash: string(hash),
		PublicKey:    publicKey,
		CreatedAt:    time.Now(),
	}

	if err := s.store.CreateUser(ctx, user); err != nil {
		log.Printf("Erro ao salvar usuário no store: %v", err)
		return nil, fmt.Errorf("erro interno ao salvar usuário")
	}

	return user, nil
}

// Login autentica um usuário e retorna um token JWT
func (s *UserService) Login(ctx context.Context, username, password string) (string, error) {
	user, err := s.store.GetUserByUsername(ctx, username)
	if err != nil {
		// Resposta genérica para evitar enumeração de usuários
		return "", fmt.Errorf("credenciais inválidas")
	}

	// Comparar a senha fornecida com o hash armazenado
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		// Senha não confere
		return "", fmt.Errorf("credenciais inválidas")
	}

	// Gerar token JWT
	token, err := s.tokenService.NewToken(user.ID)
	if err != nil {
		log.Printf("Erro ao gerar token JWT: %v", err)
		return "", fmt.Errorf("erro interno ao gerar token")
	}

	return token, nil
}

// GetUserPublicKey busca a chave pública de um usuário
func (s *UserService) GetUserPublicKey(ctx context.Context, username string) (*models.User, error) {
	user, err := s.store.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("usuário não encontrado")
	}
	return user, nil
}

// GetUserByID busca um usuário pelo ID
func (s *UserService) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	user, err := s.store.GetUserByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("usuário não encontrado")
	}
	return user, nil
}
