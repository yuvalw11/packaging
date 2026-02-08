# House Moving Packing App

A simple containerized application to help you organize items for house moving.

## Features

- ✅ Add items with types (shirt, plate, etc.)
- ✅ Associate items with suitcases/boxes
- ✅ Multiple instances of the same item type
- ✅ Items can appear in multiple suitcases
- ✅ Search items by type
- ✅ View items organized by suitcase
- ✅ Summary view showing count of each item type

## Tech Stack

- **Frontend**: React with clean, simple UI
- **Backend**: Node.js + Express + SQLite
- **Containerization**: Docker + Docker Compose

## Quick Start

### Prerequisites
- Docker
- Docker Compose

### Running the Application

1. Navigate to the project directory:
```bash
cd packing-app
```

2. Build and start the containers:
```bash
docker-compose up --build
```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Stopping the Application

```bash
docker-compose down
```

## Data Management

### Persistent Storage
All your packing data is stored in a Docker volume and will persist between container restarts.

### Backup Your Data
To backup your database:
```bash
docker cp $(docker-compose ps -q backend):/app/data/packing.db ./packing-backup.db
```

### Restore Data
To restore from a backup:
```bash
docker cp ./packing-backup.db $(docker-compose ps -q backend):/app/data/packing.db
docker-compose restart backend
```

### Reset All Data
To completely delete all data and start fresh:
```bash
docker-compose down -v
docker-compose up --build
```

## API Endpoints

- `GET /api/suitcases` - Get all suitcases
- `POST /api/suitcases` - Create a new suitcase
- `GET /api/items` - Get all items
- `POST /api/items` - Add a new item
- `DELETE /api/items/:id` - Delete an item
- `GET /api/items/search?type=<query>` - Search items by type
- `GET /api/suitcases/:id/items` - Get items in a specific suitcase
- `GET /api/items/summary` - Get count of each item type

## Usage Guide

### Adding Items
1. Go to the "Add Items" tab
2. Enter the item type (e.g., "shirt", "plate", "book")
3. Select which suitcase/box it goes in
4. Click "Add Item"

### Adding Suitcases
1. In the "Add Items" tab, scroll to "Add New Suitcase"
2. Enter a name for your suitcase/box
3. Click "Add Suitcase"

### Searching Items
1. Go to the "Search Items" tab
2. Type the item name you're looking for
3. See all matching items and which suitcase they're in

### Viewing by Suitcase
1. Go to the "By Suitcase" tab
2. See all your suitcases with their contents listed

### Item Summary
1. Go to the "Item Summary" tab
2. See how many instances of each item type you've packed

## Sample Data

The app comes pre-loaded with sample data:
- 3 suitcases (Bedroom Suitcase, Kitchen Box, Bathroom Bag)
- Various items already packed

Feel free to delete items and add your own!

## Notes

- Data is now stored persistently in a Docker volume named `packing-data`
- Your data will persist even when you restart the containers
- To completely reset the app and delete all data: `docker-compose down -v`
- The SQLite database file is stored at `/app/data/packing.db` inside the container
- Sample data is only inserted on first run when the database is empty
