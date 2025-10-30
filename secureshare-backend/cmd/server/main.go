package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"secureshare-backend/internal/api"
	"secureshare-backend/internal/auth"
	"secureshare-backend/internal/config"
	"secureshare-backend/internal/repository"
	"secureshare-backend/internal/service"

	"github.com/joho/godotenv"
)

func main() {
	// 2. CARREGAR O ARQUIVO .ENV
	// Faça isso ANTES de carregar a configuração
	err := godotenv.Load()
	if err != nil {
		// Em produção, você pode querer permitir que o app rode sem .env,
		// desde que as variáveis estejam setadas no ambiente (ex: no Docker/K8s)
		log.Printf("Aviso: Não foi possível carregar o arquivo .env: %v. (Usando variáveis de ambiente existentes)", err)
	}

	// 1. Carregar Configuração
	// (Esta parte agora lê as variáveis que o godotenv carregou)
	var cfg config.Config
	if err := config.Load(&cfg); err != nil {
		log.Fatalf("Falha ao carregar configuração: %v", err)
	}

	// 2. Inicializar Camada de Repositório (PostgreSQL)
	initCtx, cancelInit := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelInit()

	store, err := repository.NewPostgresStore(initCtx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Falha ao conectar ao banco de dados: %v", err)
	}
	defer store.Close()
	log.Println("Conectado ao PostgreSQL!")

	// ... (O resto do seu main.go continua exatamente igual) ...

	// 3. (Opcional, mas recomendado) Rodar Migrations
	migrationSQL, err := os.ReadFile("./migrations/001_init.sql")
	if err != nil {
		log.Fatalf("Falha ao ler arquivo de migração: %v", err)
	}

	if err := store.RunMigrations(initCtx, string(migrationSQL)); err != nil {
		log.Printf("Aviso ao rodar migrações: %v. (Continuando...)", err)
	} else {
		log.Println("Migrações do banco de dados aplicadas com sucesso.")
	}

	// 4. Inicializar Camada de Autenticação
	tokenService, err := auth.NewTokenService(cfg.JWTSecret)
	if err != nil {
		log.Fatalf("Falha ao iniciar TokenService: %v", err)
	}

	// 5. Inicializar Camada de Serviço
	userService := service.NewUserService(store, tokenService)
	transferService := service.NewTransferService(store)

	// 6. Inicializar Camada de API
	handler := api.NewHandler(userService, transferService, tokenService, store)

	// 7. Configurar Servidor HTTP
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.ServerPort),
		Handler:      handler.Routes(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// 8. Iniciar Servidor
	go func() {
		log.Printf("Servidor iniciado em http://localhost:%d/v1", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Erro ao iniciar servidor: %v", err)
		}
	}()

	// Aguardar sinal de interrupção
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Recebido sinal de desligamento, encerrando servidor...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Erro no graceful shutdown: %v", err)
	}
	log.Println("Servidor encerrado.")
}
