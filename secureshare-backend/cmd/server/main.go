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

	// --- IMPORTS DO AWS SDK ---
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func main() {
	// Carregar .env
	err := godotenv.Load()
	if err != nil {
		log.Printf("Aviso: Não foi possível carregar o arquivo .env: %v.", err)
	}

	// 1. Carregar Configuração
	var cfg config.Config
	if err := config.Load(&cfg); err != nil {
		log.Fatalf("Falha ao carregar configuração: %v", err)
	}

	// Contexto de inicialização
	initCtx, cancelInit := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelInit()

	// 2. Inicializar Repositório (PostgreSQL)
	store, err := repository.NewPostgresStore(initCtx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Falha ao conectar ao banco de dados: %v", err)
	}
	defer store.Close()
	log.Println("Conectado ao PostgreSQL!")

	// 3. Rodar Migrations
	migrationSQL, err := os.ReadFile("./migrations/001_init.sql")
	if err != nil {
		log.Fatalf("Falha ao ler arquivo de migração: %v", err)
	}
	if err := store.RunMigrations(initCtx, string(migrationSQL)); err != nil {
		log.Printf("Aviso ao rodar migrações: %v. (Continuando...)", err)
	} else {
		log.Println("Migrações do banco de dados aplicadas com sucesso.")
	}

	// 4. Inicializar Cliente S3 e Serviço
	// O LoadDefaultConfig irá carregar automaticamente as credenciais
	// do .env (porque o godotenv as colocou no ambiente)
	awsCfg, err := awsconfig.LoadDefaultConfig(initCtx, awsconfig.WithRegion(cfg.AWSRegion))
	if err != nil {
		log.Fatalf("Falha ao carregar configuração AWS SDK: %v", err)
	}

	s3Client := s3.NewFromConfig(awsCfg)
	s3Service := service.NewS3Service(s3Client, cfg.AWSBucketName)
	log.Println("Serviço S3 inicializado.")

	// 5. Inicializar Camada de Autenticação
	tokenService, err := auth.NewTokenService(cfg.JWTSecret)
	if err != nil {
		log.Fatalf("Falha ao iniciar TokenService: %v", err)
	}

	// 6. Inicializar Camada de Serviço
	userService := service.NewUserService(store, tokenService)
	transferService := service.NewTransferService(store)

	// 7. Inicializar Camada de API (Handlers e Rotas)
	// (Passe o novo s3Service)
	handler := api.NewHandler(
		userService,
		transferService,
		tokenService,
		store,
		s3Service, // <-- PASSE O NOVO SERVIÇO
	)

	// 8. Configurar Servidor HTTP
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.ServerPort),
		Handler:      handler.Routes(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// 9. Iniciar Servidor
	// (O resto do código de graceful shutdown permanece o mesmo)
	go func() {
		log.Printf("Servidor iniciado em http://localhost:%d/v1", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Erro ao iniciar servidor: %v", err)
		}
	}()

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
