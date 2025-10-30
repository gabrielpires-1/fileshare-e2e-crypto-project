package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// Routes configura e retorna o roteador Chi
func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	// Middlewares globais
	r.Use(middleware.Logger)       // Log de requisições
	r.Use(middleware.Recoverer)    // Recupera de panics
	r.Use(middleware.StripSlashes) // Remove barras no final da URL

	// Rotas da API V1
	r.Route("/v1", func(r chi.Router) {
		// Endpoints públicos (sem autenticação)
		r.Post("/users/register", h.handleRegisterUser)
		r.Post("/users/login", h.handleLoginUser)

		// Endpoints protegidos (requerem autenticação)
		r.Group(func(r chi.Router) {
			r.Use(h.AuthMiddleware)

			r.Get("/users/{username}/key", h.handleGetUserKey)

			r.Post("/transfers", h.handleCreateTransfer)
			r.Get("/transfers", h.handleGetTransfers)
		})
	})

	return r
}
