package repository

import (
	"context"
	"errors"
	"fmt"
	"log"

	"secureshare-backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStore é a implementação da interface Store para o PostgreSQL
type PostgresStore struct {
	db *pgxpool.Pool
}

// NewPostgresStore cria uma nova instância do PostgresStore e pool de conexões
func NewPostgresStore(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("não foi possível criar pool de conexão: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("não foi possível pingar o banco de dados: %w", err)
	}

	log.Println("Pool de conexão com PostgreSQL estabelecido.")
	return &PostgresStore{db: pool}, nil
}

// Close fecha o pool de conexões
func (s *PostgresStore) Close() {
	s.db.Close()
}

// RunMigrations executa o script SQL de migração
func (s *PostgresStore) RunMigrations(ctx context.Context, migrationSQL string) error {
	_, err := s.db.Exec(ctx, migrationSQL)
	if err != nil {
		return fmt.Errorf("falha ao executar migração: %w", err)
	}
	return nil
}

// --- UserStore ---
func (s *PostgresStore) CreateUser(ctx context.Context, user *models.User) error {
	sql := `
        INSERT INTO users (id, username, password_hash, public_key, public_key_sign, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6)`

	_, err := s.db.Exec(ctx, sql,
		user.ID,
		user.Username,
		user.PasswordHash,
		user.PublicKey,
		user.PublicKeySign,
		user.CreatedAt,
	)

	if err != nil {
		// Verifica se é um erro de violação de constraint (usuário duplicado)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // 23505 = unique_violation
			return fmt.Errorf("usuário '%s' já existe", user.Username)
		}
		// Este é o erro que você está vendo
		return fmt.Errorf("falha ao criar usuário: %w", err)
	}
	return nil
}

func (s *PostgresStore) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	sql := `
        SELECT id, username, password_hash, public_key, public_key_sign, created_at 
        FROM users 
        WHERE username = $1`

	user := &models.User{}
	err := s.db.QueryRow(ctx, sql, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.PublicKey,
		&user.PublicKeySign,
		&user.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("usuário '%s' não encontrado", username)
		}
		return nil, fmt.Errorf("falha ao buscar usuário por nome: %w", err)
	}
	return user, nil
}

func (s *PostgresStore) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	sql := `
        SELECT id, username, password_hash, public_key, public_key_sign, created_at 
        FROM users 
        WHERE id = $1`

	user := &models.User{}
	err := s.db.QueryRow(ctx, sql, id).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.PublicKey,
		&user.PublicKeySign,
		&user.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("usuário com ID '%s' não encontrado", id)
		}
		return nil, fmt.Errorf("falha ao buscar usuário por ID: %w", err)
	}
	return user, nil
}

// --- TransferStore ---

func (s *PostgresStore) CreateTransfer(ctx context.Context, transfer *models.Transfer) error {
	sql := `
        INSERT INTO transfers (id, source_user_id, dest_user_id, link_to_enc_file, skb, sig, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`

	_, err := s.db.Exec(ctx, sql,
		transfer.ID,
		transfer.SourceUserID,
		transfer.DestUserID,
		transfer.LinkToEncFile,
		transfer.SKB,
		transfer.Sig,
		transfer.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("falha ao criar transferência: %w", err)
	}
	return nil
}

func (s *PostgresStore) GetTransfersByDestUserID(ctx context.Context, destUserID uuid.UUID) ([]*models.Transfer, error) {
	sql := `
        SELECT id, source_user_id, dest_user_id, link_to_enc_file, skb, sig, created_at 
        FROM transfers 
        WHERE dest_user_id = $1
        ORDER BY created_at DESC`

	rows, err := s.db.Query(ctx, sql, destUserID)
	if err != nil {
		return nil, fmt.Errorf("falha ao buscar transferências: %w", err)
	}
	defer rows.Close()

	// Importante: inicializa como slice vazio, não nil, para consistência de JSON
	transfers := []*models.Transfer{}

	for rows.Next() {
		transfer := &models.Transfer{}
		err := rows.Scan(
			&transfer.ID,
			&transfer.SourceUserID,
			&transfer.DestUserID,
			&transfer.LinkToEncFile,
			&transfer.SKB,
			&transfer.Sig,
			&transfer.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("falha ao escanear linha de transferência: %w", err)
		}
		transfers = append(transfers, transfer)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("erro ao iterar sobre as transferências: %w", err)
	}

	return transfers, nil
}

func (s *PostgresStore) GetAllUsers(ctx context.Context) ([]*models.User, error) {
	sql := `
        SELECT id, username, password_hash, public_key, public_key_sign, created_at
        FROM users 
        ORDER BY username`

	rows, err := s.db.Query(ctx, sql)
	if err != nil {
		return nil, fmt.Errorf("falha ao buscar todos os usuários: %w", err)
	}
	defer rows.Close()

	// Inicializa como slice vazio para consistência de JSON
	users := []*models.User{}

	for rows.Next() {
		user := &models.User{}
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.PasswordHash,
			&user.PublicKey,
			&user.PublicKeySign,
			&user.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("falha ao escanear linha de usuário: %w", err)
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("erro ao iterar sobre os usuários: %w", err)
	}

	return users, nil
}
