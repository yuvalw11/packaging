# Deployment Guide

This guide explains how to deploy the Packing App to a remote server using the provided deployment script.

## Prerequisites

### On Your Local Machine
- Docker installed and running
- SSH access configured to your server
- `ssh`, `scp`, and `docker` commands available

### On Your Server
- Docker installed
- Docker Compose installed
- SSH access configured
- Sufficient disk space (at least 2GB recommended)

## Quick Start

### 1. Configure the Deployment Script

Edit `deploy.sh` and update these variables at the top of the file:

```bash
SERVER_USER="your-username"        # Your SSH username
SERVER_HOST="your-server-ip"       # Server IP or domain
SERVER_PATH="/home/your-username/packing-app"  # Deployment directory
```

### 2. Set Up SSH Access (if not already configured)

Make sure you can SSH to your server without password:

```bash
# Test SSH connection
ssh your-username@your-server-ip

# If you need to set up SSH keys:
ssh-copy-id your-username@your-server-ip
```

### 3. Run the Deployment

```bash
./deploy.sh
```

## What the Script Does

1. **Builds Docker Images** - Creates optimized production images for frontend and backend
2. **Saves Images** - Exports images to compressed tar files
3. **Transfers Files** - Uploads images and docker-compose.yml to server via SCP
4. **Loads Images** - Imports Docker images on the remote server
5. **Starts Services** - Runs docker-compose up to start the application
6. **Cleanup** - Removes temporary files

## Manual Deployment (Alternative)

If you prefer to deploy manually:

```bash
# 1. Build images locally
docker build -t packing-backend:latest -f Dockerfile.backend .
docker build -t packing-frontend:latest -f Dockerfile.frontend .

# 2. Save images
docker save packing-backend:latest | gzip > packing-backend.tar.gz
docker save packing-frontend:latest | gzip > packing-frontend.tar.gz

# 3. Transfer to server
scp packing-backend.tar.gz your-user@your-server:/path/
scp packing-frontend.tar.gz your-user@your-server:/path/
scp docker-compose.yml your-user@your-server:/path/

# 4. On the server, load and run
ssh your-user@your-server
cd /path/
docker load < packing-backend.tar.gz
docker load < packing-frontend.tar.gz
docker-compose up -d
```

## Post-Deployment

### Access Your Application

- **Frontend**: http://your-server-ip:3000
- **Backend API**: http://your-server-ip:3001/api

### Useful Commands

```bash
# View logs
ssh user@server 'cd /path/to/app && docker-compose logs -f'

# Restart services
ssh user@server 'cd /path/to/app && docker-compose restart'

# Stop services
ssh user@server 'cd /path/to/app && docker-compose down'

# Check status
ssh user@server 'cd /path/to/app && docker-compose ps'
```

### Data Persistence

The application data is stored in a Docker volume (`packing-data`). This ensures your data persists across container restarts and redeployments.

To backup your data:
```bash
# On the server
docker run --rm -v packing-data:/data -v $(pwd):/backup alpine tar czf /backup/packing-data-backup.tar.gz -C /data .
```

To restore data:
```bash
# On the server
docker run --rm -v packing-data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/packing-data-backup.tar.gz"
```

## Troubleshooting

### Permission Denied on deploy.sh

```bash
chmod +x deploy.sh
```

### Docker Not Found on Server

Install Docker on your server:
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Port Already in Use

If ports 3000 or 3001 are already in use, edit `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8001:3001"  # Change host port
  frontend:
    ports:
      - "8000:80"    # Change host port
```

### SSH Connection Issues

```bash
# Test SSH connection
ssh -v your-username@your-server-ip

# Specify SSH key explicitly in deploy.sh
ssh -i ~/.ssh/your-key your-username@your-server-ip
```

### Images Too Large

If the image transfer is too slow:

1. Use Docker registry instead (Docker Hub, GitHub Container Registry)
2. Optimize Dockerfiles (multi-stage builds, smaller base images)
3. Use rsync instead of scp for incremental transfers

## Production Considerations

### Security

1. **Use HTTPS**: Set up a reverse proxy (nginx) with SSL/TLS
2. **Firewall**: Configure firewall rules to only expose necessary ports
3. **Environment Variables**: Store sensitive data in environment variables
4. **Regular Updates**: Keep Docker and system packages updated

### Monitoring

Consider adding:
- Health checks in docker-compose.yml
- Log aggregation (ELK stack, Loki)
- Monitoring (Prometheus + Grafana)

### Scaling

For production use:
- Use nginx as reverse proxy
- Set up load balancing for multiple instances
- Use external database (PostgreSQL instead of SQLite)
- Implement caching (Redis)

## Environment Variables

You can customize the deployment by setting environment variables in `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/packing.db
      - PORT=3001
```

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Verify all services are running: `docker-compose ps`
3. Test connectivity: `curl http://localhost:3001/api/suitcases`
