package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"secureshare-backend/internal/auth"
	"secureshare-backend/internal/models"
	"secureshare-backend/internal/repository"
	"secureshare-backend/internal/service"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
)

// Handler gerencia as dependências para os handlers HTTP
type Handler struct {
	userService     *service.UserService
	transferService *service.TransferService
	tokenService    *auth.TokenService
	userStore       repository.UserStore // Necessário para mapear IDs nos handlers
	validate        *validator.Validate
}

// NewHandler cria uma nova instância do Handler
func NewHandler(
	userSvc *service.UserService,
	transferSvc *service.TransferService,
	tokenSvc *auth.TokenService,
	userStore repository.UserStore,
) *Handler {
	return &Handler{
		userService:     userSvc,
		transferService: transferSvc,
		tokenService:    tokenSvc,
		userStore:       userStore,
		validate:        validator.New(),
	}
}

// === Funções Auxiliares de Resposta ===

func (h *Handler) respondWithError(w http.ResponseWriter, code int, message string) {
	h.respondWithJSON(w, code, map[string]interface{}{
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
	})
}

func (h *Handler) respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Erro ao serializar JSON: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":{"code":500,"message":"Erro interno ao serializar resposta"}}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// === Schemas de Resposta da API (conforme OpenAPI) ===

type (
	// PublicKeyResponse (conforme OpenAPI)
	PublicKeyResponse struct {
		Username  string `json:"username"`
		PublicKey string `json:"publicKey"`
	}

	// TransferMetadata (conforme OpenAPI)
	TransferMetadata struct {
		TransferID    string    `json:"transferId"`
		SourceUser    string    `json:"sourceUser"`
		DestUser      string    `json:"destUser"`
		LinkToEncFile string    `json:"linkToEncFile"`
		SKB           string    `json:"skb"`
		Sig           string    `json:"sig"`
		CreatedAt     time.Time `json:"createdAt"`
	}
)

// === Handlers de Usuário ===

// handleRegisterUser (POST /users/register)
func (h *Handler) handleRegisterUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username  string `json:"username" validate:"required"`
		Password  string `json:"password" validate:"required,min=8"`
		PublicKey string `json:"publicKey" validate:"required"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Payload JSON inválido")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Dados inválidos: "+err.Error())
		return
	}

	_, err := h.userService.Register(r.Context(), req.Username, req.Password, req.PublicKey)
	if err != nil {
		// Verifica se é um erro de "usuário já existe"
		if err.Error() == "usuário '"+req.Username+"' já existe" {
			h.respondWithError(w, http.StatusConflict, err.Error())
			return
		}
		h.respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondWithJSON(w, http.StatusCreated, map[string]string{"message": "Usuário criado com sucesso."})
}

// handleLoginUser (POST /users/login)
func (h *Handler) handleLoginUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username" validate:"required"`
		Password string `json:"password" validate:"required"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Payload JSON inválido")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Dados inválidos: "+err.Error())
		return
	}

	token, err := h.userService.Login(r.Context(), req.Username, req.Password)
	if err != nil {
		// Erro de login (usuário/senha errados)
		h.respondWithError(w, http.StatusUnauthorized, err.Error())
		return
	}

	h.respondWithJSON(w, http.StatusOK, map[string]string{"token": token})
}

// handleGetUserKey (GET /users/{username}/key)
func (h *Handler) handleGetUserKey(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if username == "" {
		h.respondWithError(w, http.StatusBadRequest, "Nome de usuário não fornecido")
		return
	}

	user, err := h.userService.GetUserPublicKey(r.Context(), username)
	if err != nil {
		h.respondWithError(w, http.StatusNotFound, "Usuário não encontrado")
		return
	}

	// Mapeia para o schema de resposta
	response := PublicKeyResponse{
		Username:  user.Username,
		PublicKey: user.PublicKey,
	}

	h.respondWithJSON(w, http.StatusOK, response)
}

// === Handlers de Transferência ===

// handleCreateTransfer (POST /transfers)
func (h *Handler) handleCreateTransfer(w http.ResponseWriter, r *http.Request) {
	// 1. Obter o usuário de origem (SourceUser) do contexto (injetado pelo middleware)
	sourceUser, ok := r.Context().Value(userContextKey).(*models.User)
	if !ok || sourceUser == nil {
		h.respondWithError(w, http.StatusUnauthorized, "Contexto de usuário inválido")
		return
	}

	// 2. Decodificar o request (NewTransferRequest da OpenAPI)
	var req service.CreateTransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Payload JSON inválido")
		return
	}

	// Validação (simples, OpenAPI já define os campos required)
	if req.DestUsername == "" || req.LinkToEncFile == "" || req.SKB == "" || req.Sig == "" {
		h.respondWithError(w, http.StatusBadRequest, "Campos obrigatórios ausentes")
		return
	}

	// 3. Chamar o serviço para criar a transferência
	transfer, err := h.transferService.CreateTransfer(r.Context(), sourceUser.ID, req)
	if err != nil {
		// Verifica se o erro foi "usuário de destino não encontrado"
		if strings.Contains(err.Error(), "não encontrado") {
			h.respondWithError(w, http.StatusNotFound, err.Error())
			return
		}
		h.respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// 4. Mapear o modelo interno (models.Transfer) para o modelo de resposta (TransferMetadata)
	// O modelo de resposta precisa dos nomes de usuário, não dos IDs
	metadata := TransferMetadata{
		TransferID:    transfer.ID.String(),
		SourceUser:    sourceUser.Username, // Já temos o usuário de origem
		DestUser:      req.DestUsername,    // Já temos o nome de usuário de destino
		LinkToEncFile: transfer.LinkToEncFile,
		SKB:           transfer.SKB,
		Sig:           transfer.Sig,
		CreatedAt:     transfer.CreatedAt,
	}

	h.respondWithJSON(w, http.StatusCreated, metadata)
}

// handleGetTransfers (GET /transfers)
func (h *Handler) handleGetTransfers(w http.ResponseWriter, r *http.Request) {
	// 1. Obter o usuário de destino (DestUser) do contexto
	destUser, ok := r.Context().Value(userContextKey).(*models.User)
	if !ok || destUser == nil {
		h.respondWithError(w, http.StatusUnauthorized, "Contexto de usuário inválido")
		return
	}

	// 2. Chamar o serviço para buscar as transferências
	transfers, err := h.transferService.GetPendingTransfers(r.Context(), destUser.ID)
	if err != nil {
		h.respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// 3. Mapear a lista de models.Transfer para uma lista de TransferMetadata
	// Isso é um ponto crítico de N+1 em SQL, mas eficiente em-memória.
	metadataList := make([]TransferMetadata, 0, len(transfers))
	for _, t := range transfers {
		// Precisamos encontrar o nome de usuário do remetente (SourceUser)
		sourceUser, err := h.userStore.GetUserByID(r.Context(), t.SourceUserID)
		if err != nil {
			log.Printf("Erro: transferência %s tem um sourceUserID inválido: %s", t.ID, t.SourceUserID)
			continue // Pular esta transferência
		}

		metadataList = append(metadataList, TransferMetadata{
			TransferID:    t.ID.String(),
			SourceUser:    sourceUser.Username, // Mapeado do ID
			DestUser:      destUser.Username,   // O usuário atual
			LinkToEncFile: t.LinkToEncFile,
			SKB:           t.SKB,
			Sig:           t.Sig,
			CreatedAt:     t.CreatedAt,
		})
	}

	h.respondWithJSON(w, http.StatusOK, metadataList)
}
