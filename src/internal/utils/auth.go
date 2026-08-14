package utils

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

type CognitoClaims struct {
	CognitoGroups []string `json:"cognito:groups"`
	TokenUse      string   `json:"token_use"`
	Email         string   `json:"email"`
	ClientID      string   `json:"client_id"` // For access tokens
	AuthTime      int64    `json:"auth_time"`
	Username      string   `json:"username"` // access tokens
	jwt.RegisteredClaims
}

type Verifier struct {
	keyFunc  jwt.Keyfunc
	issuer   string
	clientID string
}

func NewVerifier(ctx context.Context, region, userPoolID, clientID string) (*Verifier, error) {
	issuer := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s", region, userPoolID)
	jwksURL := fmt.Sprintf("%s/.well-known/jwks.json", issuer)

	jwks, err := keyfunc.NewDefaultOverrideCtx(ctx, []string{jwksURL}, keyfunc.Override{
		RefreshInterval: time.Hour * 12,
	})
	if err != nil {
		return nil, err
	}

	return &Verifier{keyFunc: jwks.KeyfuncCtx(ctx), issuer: issuer, clientID: clientID}, nil
}

func (v *Verifier) UsernameFromRequest(headers map[string]string) string {
	if v == nil {
		return ""
	}

	authHeader := headers["Authorization"]
	if authHeader == "" {
		authHeader = headers["authorization"]
	}

	if authHeader == "" {
		return ""
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	claims := &CognitoClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, v.keyFunc, jwt.WithValidMethods([]string{"RS256"}))
	if err != nil || !token.Valid {
		return ""
	}

	decodedToken, ok := token.Claims.(*CognitoClaims)
	if !ok {
		return ""
	}

	if decodedToken.Issuer != v.issuer || decodedToken.ClientID != v.clientID {
		return ""
	}

	if decodedToken.TokenUse != "access" {
		return ""
	}

	return decodedToken.Username
}
