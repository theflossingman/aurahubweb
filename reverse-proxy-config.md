# Reverse Proxy Configuration for WebSockets

This document provides configuration examples for popular reverse proxies to ensure WebSocket compatibility with Aura OS.

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3067;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    location /ws {
        proxy_pass http://localhost:3067;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}
```

## Apache Configuration

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    
    ProxyPreserveHost On
    ProxyRequests Off
    
    # WebSocket proxy configuration
    ProxyPass /ws ws://localhost:3067/ws
    ProxyPassReverse /ws ws://localhost:3067/ws
    
    # Regular HTTP proxy
    ProxyPass / http://localhost:3067/
    ProxyPassReverse / http://localhost:3067/
    
    # Enable WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*) ws://localhost:3067/$1 [P,L]
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /(.*) http://localhost:3067/$1 [P,L]
</VirtualHost>
```

## Caddy Configuration

```caddy
your-domain.com {
    reverse_proxy localhost:3067 {
        # WebSocket support
        header_up Upgrade {http.Upgrade}
        header_up Connection {http.Connection}
    }
}
```

## Traefik Configuration (Docker)

```yaml
version: '3.8'
services:
  aura-os:
    build: .
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.aura-os.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.aura-os.entrypoints=websecure"
      - "traefik.http.routers.aura-os.tls=true"
      - "traefik.http.services.aura-os.loadbalancer.server.port=3067"
    ports:
      - "3067:3067"
    networks:
      - traefik-network

  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
    networks:
      - traefik-network

networks:
  traefik-network:
    driver: bridge
```

## Cloudflare Configuration

1. **WebSocket Support**: Ensure WebSocket support is enabled in Cloudflare dashboard
2. **SSL/TLS**: Set to Full (Strict) mode
3. **Caching**: Disable caching for WebSocket endpoints
4. **Page Rules**: Add page rule to bypass cache for `/ws` path

## HAProxy Configuration

```
frontend http_front
    bind *:80
    default_backend http_back
    
    # WebSocket detection
    acl is_websocket hdr(upgrade) -i websocket
    
    use_backend websocket_back if is_websocket
    default_backend http_back

backend websocket_back
    server ws1 localhost:3067 check
    timeout server 1h
    timeout connect 10s

backend http_back
    server web1 localhost:3067 check
```

## Key WebSocket Headers

The following headers are crucial for WebSocket compatibility:

- `Upgrade: websocket`
- `Connection: Upgrade`
- `Sec-WebSocket-Key: <key>`
- `Sec-WebSocket-Version: 13`
- `Sec-WebSocket-Protocol: <protocol>`

## Testing WebSocket Connection

Use browser developer tools to verify WebSocket connection:

1. Open Developer Tools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSockets)
4. Look for connection to `/ws`
5. Check status: Should show "101 Switching Protocols"

## Common Issues and Solutions

### Issue: WebSocket connection fails
**Solution**: Ensure reverse proxy forwards Upgrade headers correctly

### Issue: Connection drops after 30 seconds
**Solution**: Increase timeout values in reverse proxy configuration

### Issue: Mixed content errors (HTTPS)
**Solution**: Use WSS (WebSocket Secure) instead of WS when serving over HTTPS

### Issue: CORS errors
**Solution**: Configure proper CORS headers in both server and reverse proxy

## Docker with Nginx Example

```yaml
version: '3.8'
services:
  aura-os:
    build: .
    ports:
      - "3067:3067"
    networks:
      - app-network
      
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - aura-os
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

## Security Considerations

1. **Rate Limiting**: Implement rate limiting for WebSocket connections
2. **Authentication**: Add authentication for WebSocket connections
3. **Origin Validation**: Validate Origin header to prevent CSRF
4. **SSL/TLS**: Always use WSS in production environments

## Monitoring WebSocket Connections

Monitor WebSocket connections using:

- Server logs for connection events
- Browser developer tools for client-side status
- Reverse proxy access logs for connection patterns
- Custom monitoring for connection health
