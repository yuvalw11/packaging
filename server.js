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

// Helper function to generate a random pleasant color
function generateRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6',
    '#FAD7A0', '#D7BDE2', '#A9CCE3', '#F9E79F', '#A3E4D7',
    '#E8DAEF', '#D5F4E6', '#FADBD8', '#F5CBA7', '#D6EAF8',
    '#FCF3CF', '#E59866', '#85929E', '#F39C12', '#27AE60'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Helper function to ensure item type exists and optionally set category
async function ensureItemTypeExists(itemType, categoryName = null) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM item_types WHERE name = ?', [itemType], (err, row) => {
      if (err) return reject(err);
      
      if (row) {
        // Item type exists
        if (categoryName !== null) {
          // Update with category if provided (allow changing existing category)
          ensureCategoryExists(categoryName).then(categoryId => {
            db.run('UPDATE item_types SET category_id = ? WHERE name = ?', 
              [categoryId, itemType], 
              (err) => {
                if (err) return reject(err);
                resolve({ itemTypeId: row.id, categoryId });
              }
            );
          }).catch(reject);
        } else {
          resolve({ itemTypeId: row.id, categoryId: row.category_id });
        }
      } else {
        // Create new item type
        if (categoryName) {
          ensureCategoryExists(categoryName).then(categoryId => {
            db.run('INSERT INTO item_types (name, category_id) VALUES (?, ?)', 
              [itemType, categoryId], 
              function(err) {
                if (err) return reject(err);
                resolve({ itemTypeId: this.lastID, categoryId });
              }
            );
          }).catch(reject);
        } else {
          db.run('INSERT INTO item_types (name, category_id) VALUES (?, NULL)', 
            [itemType], 
            function(err) {
              if (err) return reject(err);
              resolve({ itemTypeId: this.lastID, categoryId: null });
            }
          );
        }
      }
    });
  });
}

// Helper function to ensure category exists
async function ensureCategoryExists(categoryName) {
  return new Promise((resolve, reject) => {
    if (!categoryName) return resolve(null);
    
    db.get('SELECT id FROM categories WHERE name = ?', [categoryName], (err, row) => {
      if (err) return reject(err);
      
      if (row) {
        resolve(row.id);
      } else {
        // Create new category with random color
        const color = generateRandomColor();
        db.run('INSERT INTO categories (name, color) VALUES (?, ?)', 
          [categoryName, color], 
          function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      }
    });
  });
}

db.serialize(() => {
  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS suitcases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS item_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES categories(id)
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
      categories.name as category_name,
      categories.color as category_color,
      COUNT(*) as count
    FROM items
    JOIN suitcases ON items.suitcase_id = suitcases.id
    LEFT JOIN item_types ON items.type = item_types.name
    LEFT JOIN categories ON item_types.category_id = categories.id
    GROUP BY items.type, items.suitcase_id, suitcases.name, categories.name, categories.color
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

// Get item count by type (across all suitcases) with category and suitcase info
app.get('/api/items/summary', (req, res) => {
  const query = `
    SELECT 
      items.type,
      categories.name as category_name,
      categories.color as category_color,
      suitcases.name as suitcase_name,
      COUNT(*) as count
    FROM items
    JOIN suitcases ON items.suitcase_id = suitcases.id
    LEFT JOIN item_types ON items.type = item_types.name
    LEFT JOIN categories ON item_types.category_id = categories.id
    GROUP BY items.type, categories.name, categories.color, suitcases.name
    ORDER BY items.type, suitcases.name
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get all categories
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get all item types with their categories
app.get('/api/item-types', (req, res) => {
  const query = `
    SELECT 
      item_types.id,
      item_types.name,
      item_types.category_id,
      categories.name as category_name,
      categories.color as category_color
    FROM item_types
    LEFT JOIN categories ON item_types.category_id = categories.id
    ORDER BY item_types.name
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Update item type category
app.patch('/api/item-types/:name/category', async (req, res) => {
  const { name } = req.params;
  const { category } = req.body;
  
  try {
    await ensureItemTypeExists(name, category);
    res.json({ success: true, itemType: name, category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add item (creates one row per item)
app.post('/api/items', async (req, res) => {
  const { type, suitcase_id, count = 1, category = null } = req.body;
  
  try {
    // Ensure item type exists (and create it with category if provided)
    await ensureItemTypeExists(type, category);
    
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Rename item type (updates all instances of that type across ALL suitcases)
app.patch('/api/items/rename', async (req, res) => {
  const { oldType, newType } = req.body;
  
  if (!oldType || !newType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // Update the item_types table
    await new Promise((resolve, reject) => {
      db.run('UPDATE item_types SET name = ? WHERE name = ?', [newType, oldType], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Update all items with this type
    db.run(
      'UPDATE items SET type = ? WHERE type = ?',
      [newType, oldType],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ oldType, newType, updated: this.changes });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move item to different suitcase
app.patch('/api/items/move', (req, res) => {
  const { type, from_suitcase_id, to_suitcase_id, position } = req.body;
  
  if (!type || !from_suitcase_id || !to_suitcase_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Get max position in destination suitcase
  db.get('SELECT COALESCE(MAX(position), -1) as maxPos FROM items WHERE suitcase_id = ?', [to_suitcase_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const newPosition = typeof position !== 'undefined' ? position : row.maxPos + 1;
    
    // Update the suitcase_id and position for all items of this type
    db.run(
      'UPDATE items SET suitcase_id = ?, position = ? WHERE type = ? AND suitcase_id = ?',
      [to_suitcase_id, newPosition, type, from_suitcase_id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ type, from_suitcase_id, to_suitcase_id, position: newPosition, updated: this.changes });
      }
    );
  });
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

// Export all data
app.get('/api/export', (req, res) => {
  const exportData = {
    version: '2.0', // Updated version to reflect new schema
    exportDate: new Date().toISOString(),
    suitcases: [],
    items: [],
    categories: [],
    item_types: []
  };

  // Get all suitcases
  db.all('SELECT * FROM suitcases', (err, suitcases) => {
    if (err) return res.status(500).json({ error: err.message });
    exportData.suitcases = suitcases;

    // Get all items
    db.all('SELECT * FROM items', (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      exportData.items = items;

      // Get all categories
      db.all('SELECT * FROM categories', (err, categories) => {
        if (err) return res.status(500).json({ error: err.message });
        exportData.categories = categories;

        // Get all item types
        db.all('SELECT * FROM item_types', (err, item_types) => {
          if (err) return res.status(500).json({ error: err.message });
          exportData.item_types = item_types;

          res.json(exportData);
        });
      });
    });
  });
});

// Import data
app.post('/api/import', (req, res) => {
  const data = req.body;

  // Validate data structure
  if (!data || !data.suitcases || !data.items) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  const isV2 = data.version === '2.0' && data.categories && data.item_types;

  // Clear existing data
  db.serialize(() => {
    // Delete in correct order to respect foreign keys
    db.run('DELETE FROM items', (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.run('DELETE FROM item_types', (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run('DELETE FROM categories', (err) => {
          if (err) return res.status(500).json({ error: err.message });

          db.run('DELETE FROM suitcases', (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Import suitcases
            const suitcaseStmt = db.prepare('INSERT INTO suitcases (id, name) VALUES (?, ?)');
            data.suitcases.forEach(suitcase => {
              suitcaseStmt.run(suitcase.id, suitcase.name);
            });
            suitcaseStmt.finalize();

            const importCounts = {
              suitcases: data.suitcases.length,
              items: data.items.length,
              categories: 0,
              item_types: 0
            };

            // Import categories if v2.0
            if (isV2 && data.categories.length > 0) {
              const categoryStmt = db.prepare('INSERT INTO categories (id, name, color) VALUES (?, ?, ?)');
              data.categories.forEach(category => {
                categoryStmt.run(category.id, category.name, category.color);
              });
              categoryStmt.finalize();
              importCounts.categories = data.categories.length;
            }

            // Import item types if v2.0
            if (isV2 && data.item_types.length > 0) {
              const itemTypeStmt = db.prepare('INSERT INTO item_types (id, name, category_id) VALUES (?, ?, ?)');
              data.item_types.forEach(itemType => {
                itemTypeStmt.run(itemType.id, itemType.name, itemType.category_id);
              });
              itemTypeStmt.finalize();
              importCounts.item_types = data.item_types.length;
            }

            // Import items (backward compatible)
            const itemStmt = db.prepare('INSERT INTO items (id, type, suitcase_id, position) VALUES (?, ?, ?, ?)');
            data.items.forEach(item => {
              const position = item.position !== undefined ? item.position : 0;
              itemStmt.run(item.id, item.type, item.suitcase_id, position);
            });
            itemStmt.finalize();

            res.json({ 
              success: true, 
              imported: importCounts,
              version: isV2 ? '2.0' : '1.0 (backward compatible)'
            });
          });
        });
      });
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
