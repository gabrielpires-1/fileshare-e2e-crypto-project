package config

import (
	"github.com/kelseyhightower/envconfig"
)

// Config armazena a configuração da aplicação
type Config struct {
	ServerPort    int    `envconfig:"SERVER_PORT" default:"8080"`
	JWTSecret     string `envconfig:"JWT_SECRET" required:"true"`
	DatabaseURL   string `envconfig:"DATABASE_URL" required:"true"`
	AWSBucketName string `envconfig:"AWS_BUCKET_NAME" required:"true"`
	AWSRegion     string `envconfig:"AWS_REGION" required:"true"`
}

// Load carrega a configuração das variáveis de ambiente
func Load(cfg *Config) error {
	return envconfig.Process("", cfg)
}
