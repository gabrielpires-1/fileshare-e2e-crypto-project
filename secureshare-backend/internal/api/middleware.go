package api

import (
	"context"
	"net/http"
	"strings"
)

// contextKey é um tipo privado para evitar colisões de chaves no contexto
type contextKey string

const userContextKey = contextKey("user")

// AuthMiddleware é um middleware para validar o token JWT
func (h *Handler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Obter o header "Authorization"
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			h.respondWithError(w, http.StatusUnauthorized, "Token de autorização não fornecido")
			return
		}

		// 2. Verificar se o formato é "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			h.respondWithError(w, http.StatusUnauthorized, "Formato do token inválido")
			return
		}
		tokenString := parts[1]

		// 3. Validar o token
		token, err := h.tokenService.ValidateToken(tokenString)
		if err != nil {
			h.respondWithError(w, http.StatusUnauthorized, "Token inválido")
			return
		}

		// 4. Obter o UserID do token
		userID, err := h.tokenService.GetUserIDFromToken(token)
		if err != nil {
			h.respondWithError(w, http.StatusUnauthorized, "Token inválido (claims)")
			return
		}

		// 5. (Opcional, mas recomendado) Verificar se o usuário ainda existe no DB
		user, err := h.userStore.GetUserByID(r.Context(), userID)
		if err != nil {
			h.respondWithError(w, http.StatusUnauthorized, "Usuário do token não encontrado")
			return
		}

		// 6. Armazenar o usuário no contexto da requisição
		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
