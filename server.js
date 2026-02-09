const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize database with persistent file storage
const dbPath = process.env.DB_PATH || '/app/data/packing.db';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS suitcases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    suitcase_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    FOREIGN KEY (suitcase_id) REFERENCES suitcases(id)
  )`);

  // Insert sample data only if tables are empty
  db.get('SELECT COUNT(*) as count FROM suitcases', (err, row) => {
    if (!err && row.count === 0) {
      db.run(`INSERT INTO suitcases (name) VALUES ('Bedroom Suitcase'), ('Kitchen Box'), ('Bathroom Bag')`);
      // Insert multiple rows for same type to represent count
      db.run(`INSERT INTO items (type, suitcase_id, position) VALUES 
        ('shirt', 1, 0), ('shirt', 1, 0), ('pants', 1, 1), ('socks', 1, 2), ('socks', 1, 2), ('socks', 1, 2), ('socks', 1, 2), ('socks', 1, 2),
        ('plate', 2, 0), ('plate', 2, 0), ('plate', 2, 0), ('plate', 2, 0), ('cup', 2, 1), ('cup', 2, 1), ('cup', 2, 1), ('cup', 2, 1), ('cup', 2, 1), ('cup', 2, 1),
        ('toothbrush', 3, 0), ('toothbrush', 3, 0), ('towel', 3, 1), ('towel', 3, 1), ('towel', 3, 1)`);
      console.log('Sample data inserted');
    } else {
      console.log('Using existing database data');
    }
  });
});

// Get all suitcases
app.get('/api/suitcases', (req, res) => {
  db.all('SELECT * FROM suitcases', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add suitcase
app.post('/api/suitcases', (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO suitcases (name) VALUES (?)', [name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name });
  });
});

// Get all items (grouped by type and suitcase with counts)
app.get('/api/items', (req, res) => {
  const query = `
    SELECT 
      MIN(items.id) as id,
      items.type, 
      items.suitcase_id, 
      suitcases.name as suitcase_name,
      MIN(items.position) as position,
      COUNT(*) as count
    FROM items
    JOIN suitcases ON items.suitcase_id = suitcases.id
    GROUP BY items.type, items.suitcase_id, suitcases.name
    ORDER BY suitcases.name, MIN(items.position), items.type
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Search items by type (grouped with counts)
app.get('/api/items/search', (req, res) => {
  const { type } = req.query;
  const query = `
    SELECT 
      MIN(items.id) as id,
      items.type, 
      items.suitcase_id, 
      suitcases.name as suitcase_name,
      COUNT(*) as count
    FROM items
    JOIN suitcases ON items.suitcase_id = suitcases.id
    WHERE items.type LIKE ?
    GROUP BY items.type, items.suitcase_id, suitcases.name
    ORDER BY items.type
  `;
  db.all(query, [`%${type}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get items by suitcase (grouped by type with counts)
app.get('/api/suitcases/:id/items', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT 
      MIN(id) as id,
      type,
      suitcase_id,
      MIN(position) as position,
      COUNT(*) as count
    FROM items 
    WHERE suitcase_id = ?
    GROUP BY type, suitcase_id
    ORDER BY MIN(position), type
  `;
  db.all(query, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get item count by type (across all suitcases)
app.get('/api/items/summary', (req, res) => {
  const query = `
    SELECT type, COUNT(*) as count
    FROM items
    GROUP BY type
    ORDER BY type
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add item (creates one row per item)
app.post('/api/items', (req, res) => {
  const { type, suitcase_id, count = 1 } = req.body;
  
  // Get the max position for this suitcase
  db.get('SELECT COALESCE(MAX(position), -1) as maxPos FROM items WHERE suitcase_id = ?', [suitcase_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const newPosition = row.maxPos + 1;
    
    // Insert multiple rows based on count with the new position
    const placeholders = Array(count).fill('(?, ?, ?)').join(',');
    const values = Array(count).fill([type, suitcase_id, newPosition]).flat();
    
    db.run(`INSERT INTO items (type, suitcase_id, position) VALUES ${placeholders}`, values, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ type, count, suitcase_id, position: newPosition, rowsInserted: count });
    });
  });
});

// Increase item count (adds one more row)
app.post('/api/items/increment', (req, res) => {
  const { type, suitcase_id } = req.body;
  
  // Get the position from existing items of this type
  db.get('SELECT position FROM items WHERE type = ? AND suitcase_id = ? LIMIT 1', [type, suitcase_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const position = row ? row.position : 0;
    
    db.run('INSERT INTO items (type, suitcase_id, position) VALUES (?, ?, ?)', [type, suitcase_id, position], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ type, suitcase_id, added: 1 });
    });
  });
});

// Decrease item count (removes one row)
app.post('/api/items/decrement', (req, res) => {
  const { type, suitcase_id } = req.body;
  
  // Get one item ID to delete
  db.get('SELECT id FROM items WHERE type = ? AND suitcase_id = ? LIMIT 1', [type, suitcase_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Item not found' });
    
    db.run('DELETE FROM items WHERE id = ?', [row.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ type, suitcase_id, removed: 1 });
    });
  });
});

// Update positions for items in a suitcase
app.post('/api/items/reorder', (req, res) => {
  const { items } = req.body; // Array of { type, suitcase_id, position }
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items to reorder' });
  }
  
  // Update position for all rows of each type
  const promises = items.map(({ type, suitcase_id, position }) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE items SET position = ? WHERE type = ? AND suitcase_id = ?',
        [position, type, suitcase_id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
  
  Promise.all(promises)
    .then(() => res.json({ updated: items.length }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Update item count
app.patch('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const { count } = req.body;
  db.run('UPDATE items SET count = ? WHERE id = ?', [count, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, count, updated: this.changes });
  });
});

// Rename item type (updates all instances of that type in a suitcase)
app.patch('/api/items/rename', (req, res) => {
  const { oldType, newType, suitcase_id } = req.body;
  
  if (!oldType || !newType || !suitcase_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.run(
    'UPDATE items SET type = ? WHERE type = ? AND suitcase_id = ?',
    [newType, oldType, suitcase_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ oldType, newType, suitcase_id, updated: this.changes });
    }
  );
});

// Move item to different suitcase
app.patch('/api/items/move', (req, res) => {
  const { type, from_suitcase_id, to_suitcase_id, position } = req.body;
  
  if (!type || !from_suitcase_id || !to_suitcase_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Update the suitcase_id and position for all items of this type
  db.run(
    'UPDATE items SET suitcase_id = ?, position = ? WHERE type = ? AND suitcase_id = ?',
    [to_suitcase_id, position, type, from_suitcase_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ type, from_suitcase_id, to_suitcase_id, position, updated: this.changes });
    }
  );
});

// Delete item (removes all instances of type in suitcase)
app.delete('/api/items/:type/:suitcase_id', (req, res) => {
  const { type, suitcase_id } = req.params;
  db.run('DELETE FROM items WHERE type = ? AND suitcase_id = ?', [type, suitcase_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// Delete suitcase (and all its items)
app.delete('/api/suitcases/:id', (req, res) => {
  const { id } = req.params;
  
  // First delete all items in the suitcase
  db.run('DELETE FROM items WHERE suitcase_id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Then delete the suitcase itself
    db.run('DELETE FROM suitcases WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
