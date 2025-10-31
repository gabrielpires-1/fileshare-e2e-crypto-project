// internal/api/routes.go
package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors" // <-- 1. Importe o pacote
)

// Routes configura e retorna o roteador Chi
func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	// Middlewares globais
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.StripSlashes)

	// --- 2. ADICIONE A CONFIGURAÇÃO DE CORS AQUI ---
	// Isso permite que seu frontend (localhost:3000)
	// se comunique com seu backend (localhost:8080)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300, // Tempo de cache da preflight
	}))
	// ------------------------------------------

	// Rotas da API V1
	r.Route("/v1", func(r chi.Router) {
		// Endpoints públicos (sem autenticação)
		r.Post("/users/register", h.handleRegisterUser)
		r.Post("/users/login", h.handleLoginUser)

		// Endpoints protegidos (requerem autenticação)
		r.Group(func(r chi.Router) {
			r.Use(h.AuthMiddleware)

			r.Get("/users", h.handleGetAllUsers)
			r.Get("/users/{username}/key", h.handleGetUserKey)
			
			r.Get("/transfers/download-url", h.handleGetDownloadURL)
			r.Post("/transfers/upload-url", h.handleGetUploadURL)

			r.Post("/transfers", h.handleCreateTransfer)
			r.Get("/transfers", h.handleGetTransfers)
		})
	})

	return r
}
