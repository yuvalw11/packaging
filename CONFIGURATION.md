# Configuration Guide

This guide explains how to configure API URLs for different deployment scenarios.

## Overview

The app now supports flexible API URL configuration for both development and production environments, with full support for reverse proxy setups.

## How It Works

### Default Behavior (Recommended for Production)

By default, the app uses **relative paths** (`/api`) for API calls. This works perfectly when:
- The frontend and backend are served behind a reverse proxy (like nginx)
- All traffic goes through a single domain/port

This is the **recommended production setup** as it's the most secure and flexible.

### Configuration Options

You can configure the API URL in three ways:

1. **Environment variable during Docker build** (Production)
2. **`.env` file** (Development)
3. **Default fallback** (Uses `/api`)

## Deployment Scenarios

### Scenario 1: Docker with Nginx Proxy (Recommended)

**Setup:**
- Frontend served on port 3000
- Backend served on port 3001
- Nginx proxies `/api` requests to backend

**Configuration:**
```bash
# Use default - no configuration needed
docker-compose up --build
```

**How it works:**
- Frontend makes requests to `/api/*`
- Nginx intercepts and forwards to `backend:3001/api/*`
- User accesses everything through `http://yourserver:3000`

**Advantages:**
- Single port access
- CORS not needed
- Easy SSL/TLS setup
- Can add authentication at proxy level

---

### Scenario 2: Separate Frontend/Backend URLs

**Setup:**
- Frontend on one server: `frontend.example.com`
- Backend on another: `api.example.com`

**Configuration:**
```bash
# Set environment variable before build
export REACT_APP_API_URL=https://api.example.com/api
docker-compose up --build

# OR pass during build
docker-compose build --build-arg REACT_APP_API_URL=https://api.example.com/api
docker-compose up
```

**Note:** You'll need to configure CORS on the backend for this setup.

---

### Scenario 3: Development (Local)

**Setup:**
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

**Configuration:**

Create a `.env` file:
```bash
REACT_APP_API_URL=http://localhost:3001/api
```

Then build:
```bash
docker-compose up --build
```

**For local development without Docker:**
```bash
# Terminal 1 - Backend
node server.js

# Terminal 2 - Frontend
cd /path/to/project
REACT_APP_API_URL=http://localhost:3001/api npm start
```

---

## Environment Variables

### REACT_APP_API_URL

**Purpose:** Sets the base URL for all API calls

**Valid values:**
- `/api` - Relative path (for proxy setup)
- `http://localhost:3001/api` - Full URL with HTTP
- `https://api.example.com/api` - Full URL with HTTPS
- Any valid URL ending with `/api`

**Priority order:**
1. Build argument: `--build-arg REACT_APP_API_URL=...`
2. Environment variable: `export REACT_APP_API_URL=...`
3. `.env` file: `REACT_APP_API_URL=...`
4. Default: `/api`

---

## Nginx Configuration

The included `nginx.conf` is configured to proxy API requests:

```nginx
location /api/ {
    proxy_pass http://backend:3001/api/;
    # ... proxy headers ...
}
```

**How to customize:**

If your backend is external:
```nginx
location /api/ {
    proxy_pass https://your-backend-server.com/api/;
    # ... proxy headers ...
}
```

---

## Docker Compose Examples

### Example 1: Default Proxy Setup

```yaml
services:
  frontend:
    build:
      args:
        REACT_APP_API_URL: /api  # Uses nginx proxy
```

### Example 2: External API

```yaml
services:
  frontend:
    build:
      args:
        REACT_APP_API_URL: https://api.production.com/api
```

### Example 3: Using .env file

Create `.env`:
```
REACT_APP_API_URL=http://192.168.1.100:3001/api
```

Then use in docker-compose.yml:
```yaml
services:
  frontend:
    build:
      args:
        REACT_APP_API_URL: ${REACT_APP_API_URL}
```

---

## Testing Your Configuration

### 1. Check the built frontend

```bash
docker-compose build frontend
docker run --rm packing-frontend:latest sh -c "grep -r 'REACT_APP_API_URL' /usr/share/nginx/html/static/js/*.js | head -1"
```

### 2. Test API connectivity

```bash
# Access your frontend
open http://localhost:3000

# Open browser console (F12)
# Check Network tab for API calls
# They should go to the correct URL
```

### 3. Verify nginx proxy

```bash
# From inside frontend container
docker-compose exec frontend sh
wget -O- http://backend:3001/api/suitcases
```

---

## Production Best Practices

### 1. Use Nginx Proxy (Recommended)

```
Internet -> Nginx (port 80/443) -> Frontend (port 80)
                                 -> Backend (port 3001)
```

**Benefits:**
- Single entry point
- Easy SSL termination
- No CORS issues
- Can add rate limiting, caching, etc.

### 2. Use HTTPS

Add SSL configuration to nginx:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ... rest of config
}
```

### 3. Set Proper Headers

Already configured in `nginx.conf`:
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

These help the backend know about the original client.

---

## Troubleshooting

### API calls fail with CORS errors

**Cause:** Frontend trying to call backend on different origin without proxy

**Solution:** 
1. Use nginx proxy (recommended)
2. Or configure CORS on backend

### API calls go to wrong URL

**Check:**
```bash
# View the compiled JavaScript to see what URL is baked in
docker run --rm packing-frontend:latest cat /usr/share/nginx/html/static/js/main.*.js | grep -o '/api\|http[s]*://[^"]*api'
```

### Nginx proxy not working

**Verify backend is accessible:**
```bash
docker-compose exec frontend sh
wget http://backend:3001/api/suitcases
```

**Check nginx logs:**
```bash
docker-compose logs frontend
```

### Build doesn't pick up environment variable

**Problem:** Changed .env but build still uses old value

**Solution:** Force rebuild
```bash
docker-compose build --no-cache --build-arg REACT_APP_API_URL=/api frontend
```

---

## Quick Reference

| Scenario | REACT_APP_API_URL | Notes |
|----------|-------------------|-------|
| Docker with proxy | `/api` (default) | Recommended |
| Local development | `http://localhost:3001/api` | Via .env file |
| Production separate domains | `https://api.example.com/api` | Need CORS |
| Production IP-based | `http://192.168.1.100:3001/api` | Need CORS |

---

## Summary

✅ **Recommended:** Use default `/api` with nginx proxy
- Simplest setup
- Most secure
- Easiest to maintain
- Works perfectly behind reverse proxies

⚠️ **Alternative:** Use full URL for separate servers
- More complex
- Requires CORS configuration
- Can have security implications
