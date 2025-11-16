/* migrations/001_init.sql */

-- Habilita a extensão para o tipo UUID, se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    public_key    TEXT NOT NULL,
    public_key_sign TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW())
);

-- Tabela de Transferências
CREATE TABLE IF NOT EXISTS transfers (
    id                 UUID PRIMARY KEY,
    source_user_id     UUID NOT NULL,
    dest_user_id       UUID NOT NULL,
    link_to_enc_file   TEXT NOT NULL,
    skb                TEXT NOT NULL, -- Armazena a string Base64
    sig                TEXT NOT NULL, -- Armazena a string Base64
    created_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW()),

    -- Chaves estrangeiras para garantir a integridade dos dados
    CONSTRAINT fk_source_user
        FOREIGN KEY(source_user_id) 
        REFERENCES users(id)
        ON DELETE CASCADE, -- Se o usuário for deletado, suas transferências enviadas somem

    CONSTRAINT fk_dest_user
        FOREIGN KEY(dest_user_id) 
        REFERENCES users(id)
        ON DELETE CASCADE  -- Se o usuário for deletado, suas transferências recebidas somem
);

-- Índices para otimizar as buscas
CREATE INDEX IF NOT EXISTS idx_transfers_dest_user_id ON transfers(dest_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);