package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// TokenService lida com a lógica de JWT
type TokenService struct {
	jwtSecret []byte
}

// NewTokenService cria um novo serviço de token
func NewTokenService(secret string) (*TokenService, error) {
	if secret == "" {
		return nil, fmt.Errorf("segredo JWT não pode ser vazio")
	}
	return &TokenService{
		jwtSecret: []byte(secret),
	}, nil
}

// NewToken cria um novo token JWT para um usuário
func (s *TokenService) NewToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID.String(), // 'subject' (o ID do usuário)
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Hour * 24).Unix(), // Token expira em 24h
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// ValidateToken verifica a validade de um token string
func (s *TokenService) ValidateToken(tokenString string) (*jwt.Token, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Verifica o método de assinatura
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de assinatura inesperado: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("falha ao parsear token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("token inválido")
	}

	return token, nil
}

// GetUserIDFromToken extrai o 'sub' (UserID) de um token validado
func (s *TokenService) GetUserIDFromToken(token *jwt.Token) (uuid.UUID, error) {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, fmt.Errorf("não foi possível ler claims do token")
	}

	sub, err := claims.GetSubject()
	if err != nil {
		return uuid.Nil, fmt.Errorf("não foi possível obter 'sub' do token: %w", err)
	}

	userID, err := uuid.Parse(sub)
	if err != nil {
		return uuid.Nil, fmt.Errorf("'sub' do token não é um UUID válido: %w", err)
	}

	return userID, nil
}
