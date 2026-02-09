import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [suitcases, setSuitcases] = useState([]);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [activeTab, setActiveTab] = useState('manage');
  
  // Form states
  const [newItemType, setNewItemType] = useState('');
  const [newItemCount, setNewItemCount] = useState(1);
  const [selectedSuitcase, setSelectedSuitcase] = useState('');
  const [newSuitcaseName, setNewSuitcaseName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuitcaseForAdding, setActiveSuitcaseForAdding] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editItemType, setEditItemType] = useState('');
  const [showEditSuggestions, setShowEditSuggestions] = useState(false);

  // Get unique item types for autocomplete
  const uniqueItemTypes = [...new Set(items.map(item => item.type))].sort();

  useEffect(() => {
    fetchSuitcases();
    fetchItems();
    fetchSummary();
  }, []);

  const fetchSuitcases = async () => {
    const res = await fetch(`${API_URL}/suitcases`);
    const data = await res.json();
    setSuitcases(data);
    if (data.length > 0 && !selectedSuitcase) {
      setSelectedSuitcase(data[0].id);
    }
  };

  const fetchItems = async () => {
    const res = await fetch(`${API_URL}/items`);
    const data = await res.json();
    setItems(data);
  };

  const fetchSummary = async () => {
    const res = await fetch(`${API_URL}/items/summary`);
    const data = await res.json();
    setSummary(data);
  };

  const addItem = async (e, suitcaseId) => {
    e.preventDefault();
    if (!newItemType || !suitcaseId) return;
    
    await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newItemType, count: newItemCount, suitcase_id: suitcaseId })
    });
    
    setNewItemType('');
    setNewItemCount(1);
    setShowSuggestions(false);
    fetchItems();
    fetchSummary();
  };

  const addSuitcase = async (e) => {
    e.preventDefault();
    if (!newSuitcaseName) return;
    
    const res = await fetch(`${API_URL}/suitcases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSuitcaseName })
    });
    
    const newSuitcase = await res.json();
    setNewSuitcaseName('');
    await fetchSuitcases();
    setActiveSuitcaseForAdding(newSuitcase.id);
  };

  const deleteItem = async (type, suitcaseId) => {
    if (!window.confirm(`Delete all ${type} items from this suitcase?`)) return;
    
    await fetch(`${API_URL}/items/${encodeURIComponent(type)}/${suitcaseId}`, { method: 'DELETE' });
    fetchItems();
    fetchSummary();
  };

  const incrementItemCount = async (type, suitcaseId) => {
    await fetch(`${API_URL}/items/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, suitcase_id: suitcaseId })
    });
    
    fetchItems();
    fetchSummary();
  };

  const decrementItemCount = async (type, suitcaseId, currentCount) => {
    if (currentCount <= 1) {
      deleteItem(type, suitcaseId);
      return;
    }
    
    await fetch(`${API_URL}/items/decrement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, suitcase_id: suitcaseId })
    });
    
    fetchItems();
    fetchSummary();
  };

  const deleteSuitcase = async (id) => {
    if (!window.confirm('Delete this suitcase and all its items?')) return;
    
    await fetch(`${API_URL}/suitcases/${id}`, { method: 'DELETE' });
    fetchSuitcases();
    fetchItems();
    fetchSummary();
  };

  const searchItems = async () => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`${API_URL}/items/search?type=${searchTerm}`);
    const data = await res.json();
    setSearchResults(data);
  };

  const handleItemTypeChange = (value) => {
    setNewItemType(value);
    setShowSuggestions(value.length > 0);
  };

  const selectSuggestion = (suggestion) => {
    setNewItemType(suggestion);
    setShowSuggestions(false);
  };

  const getFilteredSuggestions = () => {
    if (!newItemType) return [];
    return uniqueItemTypes.filter(type => 
      type.toLowerCase().includes(newItemType.toLowerCase())
    );
  };

  const handleDragStart = (e, item, index, suitcaseId) => {
    setDraggedItem({ item, index, suitcaseId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index, suitcaseId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex, suitcaseId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedItem) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }
    
    const fromSuitcaseId = draggedItem.suitcaseId;
    const toSuitcaseId = suitcaseId;
    
    // Moving to a different suitcase
    if (fromSuitcaseId !== toSuitcaseId) {
      await fetch(`${API_URL}/items/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: draggedItem.item.type,
          from_suitcase_id: fromSuitcaseId,
          to_suitcase_id: toSuitcaseId,
          position: dropIndex
        })
      });
      
      // Reorder items in the destination suitcase
      const destItems = items.filter(item => item.suitcase_id === toSuitcaseId);
      const updates = destItems.map((item, index) => ({
        type: item.type,
        suitcase_id: toSuitcaseId,
        position: index >= dropIndex ? index + 1 : index
      }));
      
      if (updates.length > 0) {
        await fetch(`${API_URL}/items/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: updates })
        });
      }
    } else {
      // Reordering within same suitcase
      const suitcaseItems = items.filter(item => item.suitcase_id === suitcaseId);
      const newItems = [...suitcaseItems];
      
      // Remove from old position and insert at new position
      const [movedItem] = newItems.splice(draggedItem.index, 1);
      newItems.splice(dropIndex, 0, movedItem);
      
      // Update positions
      const updates = newItems.map((item, index) => ({
        type: item.type,
        suitcase_id: suitcaseId,
        position: index
      }));
      
      await fetch(`${API_URL}/items/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates })
      });
    }
    
    setDraggedItem(null);
    setDragOverIndex(null);
    await fetchItems();
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const startEditingItem = (item) => {
    setEditingItem({ type: item.type, suitcase_id: item.suitcase_id });
    setEditItemType(item.type);
    setShowEditSuggestions(false);
  };

  const cancelEditingItem = () => {
    setEditingItem(null);
    setEditItemType('');
    setShowEditSuggestions(false);
  };

  const saveEditedItem = async (oldType, suitcaseId) => {
    if (!editItemType || editItemType === oldType) {
      cancelEditingItem();
      return;
    }

    await fetch(`${API_URL}/items/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        oldType: oldType, 
        newType: editItemType, 
        suitcase_id: suitcaseId 
      })
    });

    cancelEditingItem();
    fetchItems();
    fetchSummary();
  };

  const handleEditItemTypeChange = (value) => {
    setEditItemType(value);
    setShowEditSuggestions(value.length > 0);
  };

  const selectEditSuggestion = (suggestion) => {
    setEditItemType(suggestion);
    setShowEditSuggestions(false);
  };

  const getFilteredEditSuggestions = () => {
    if (!editItemType) return [];
    return uniqueItemTypes.filter(type => 
      type.toLowerCase().includes(editItemType.toLowerCase())
    );
  };

  const groupedBySuitcase = items.reduce((acc, item) => {
    if (!acc[item.suitcase_id]) {
      acc[item.suitcase_id] = {
        name: item.suitcase_name,
        items: []
      };
    }
    acc[item.suitcase_id].items.push(item);
    return acc;
  }, {});

  return (
    <div className="App">
      <header>
        <h1>📦 House Moving Packing App</h1>
      </header>

      <nav className="tabs">
        <button 
          className={activeTab === 'manage' ? 'active' : ''} 
          onClick={() => setActiveTab('manage')}
        >
          Manage Suitcases
        </button>
        <button 
          className={activeTab === 'search' ? 'active' : ''} 
          onClick={() => setActiveTab('search')}
        >
          Search Items
        </button>
        <button 
          className={activeTab === 'summary' ? 'active' : ''} 
          onClick={() => setActiveTab('summary')}
        >
          Item Summary
        </button>
      </nav>

      <main>
        {activeTab === 'manage' && (
          <div className="section">
            <h2>Add New Suitcase</h2>
            <form onSubmit={addSuitcase} className="form">
              <input
                type="text"
                placeholder="Suitcase name (e.g., Bedroom Box, Kitchen Suitcase)"
                value={newSuitcaseName}
                onChange={(e) => setNewSuitcaseName(e.target.value)}
              />
              <button type="submit">Add Suitcase</button>
            </form>

            <h2>Your Suitcases</h2>
            {suitcases.length === 0 ? (
              <p className="empty-message">No suitcases yet. Add one above to get started!</p>
            ) : (
              suitcases.map(suitcase => {
                const suitcaseItems = items.filter(item => item.suitcase_id === suitcase.id);
                const isAdding = activeSuitcaseForAdding === suitcase.id;
                
                return (
                  <div key={suitcase.id} className="suitcase-card">
                    <div className="suitcase-header">
                      <h3>{suitcase.name}</h3>
                      <div className="suitcase-actions">
                        <button 
                          onClick={() => setActiveSuitcaseForAdding(isAdding ? null : suitcase.id)} 
                          className="add-item-btn"
                        >
                          {isAdding ? 'Close' : '+ Add Item'}
                        </button>
                        <button 
                          onClick={() => deleteSuitcase(suitcase.id)} 
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {isAdding && (
                      <form onSubmit={(e) => addItem(e, suitcase.id)} className="add-item-form">
                        <div className="autocomplete-wrapper">
                          <input
                            type="text"
                            placeholder="Item type (e.g., shirt, plate, book)"
                            value={newItemType}
                            onChange={(e) => handleItemTypeChange(e.target.value)}
                            onFocus={() => setShowSuggestions(newItemType.length > 0)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            autoComplete="off"
                          />
                          {showSuggestions && getFilteredSuggestions().length > 0 && (
                            <div className="suggestions-dropdown">
                              {getFilteredSuggestions().map((suggestion, idx) => (
                                <div 
                                  key={idx} 
                                  className="suggestion-item"
                                  onClick={() => selectSuggestion(suggestion)}
                                >
                                  {suggestion}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          min="1"
                          placeholder="Count"
                          value={newItemCount}
                          onChange={(e) => setNewItemCount(parseInt(e.target.value) || 1)}
                          className="count-input"
                        />
                        <button type="submit">Add</button>
                      </form>
                    )}

                    {suitcaseItems.length > 0 ? (
                      <table className="items-table">
                        <thead>
                          <tr>
                            <th width="40"></th>
                            <th>Item Type</th>
                            <th>Count</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suitcaseItems.map((item, index) => (
                            <tr 
                              key={`${item.type}-${item.suitcase_id}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, item, index, suitcase.id)}
                              onDragOver={(e) => handleDragOver(e, index, suitcase.id)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, index, suitcase.id)}
                              onDragEnd={handleDragEnd}
                              className={`
                                draggable-row
                                ${draggedItem?.index === index && draggedItem?.suitcaseId === suitcase.id ? 'dragging' : ''}
                                ${dragOverIndex === index && draggedItem?.suitcaseId === suitcase.id ? 'drag-over' : ''}
                              `}
                            >
                              <td className="drag-handle">
                                <span className="drag-icon">⋮⋮</span>
                              </td>
                              <td>
                                {editingItem?.type === item.type && editingItem?.suitcase_id === item.suitcase_id ? (
                                  <div className="edit-item-wrapper">
                                    <div className="autocomplete-wrapper">
                                      <input
                                        type="text"
                                        value={editItemType}
                                        onChange={(e) => handleEditItemTypeChange(e.target.value)}
                                        onFocus={() => setShowEditSuggestions(editItemType.length > 0)}
                                        onBlur={() => setTimeout(() => setShowEditSuggestions(false), 200)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            saveEditedItem(item.type, item.suitcase_id);
                                          } else if (e.key === 'Escape') {
                                            cancelEditingItem();
                                          }
                                        }}
                                        autoComplete="off"
                                        autoFocus
                                        className="edit-input"
                                      />
                                      {showEditSuggestions && getFilteredEditSuggestions().length > 0 && (
                                        <div className="suggestions-dropdown">
                                          {getFilteredEditSuggestions().map((suggestion, idx) => (
                                            <div 
                                              key={idx} 
                                              className="suggestion-item"
                                              onClick={() => selectEditSuggestion(suggestion)}
                                            >
                                              {suggestion}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <button 
                                      onClick={() => saveEditedItem(item.type, item.suitcase_id)}
                                      className="edit-save-btn"
                                      title="Save"
                                    >
                                      ✓
                                    </button>
                                    <button 
                                      onClick={cancelEditingItem}
                                      className="edit-cancel-btn"
                                      title="Cancel"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <span 
                                    onClick={() => startEditingItem(item)}
                                    className="editable-item-name"
                                    title="Click to edit"
                                  >
                                    {item.type}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className="count-controls">
                                  <button 
                                    className="count-btn"
                                    onClick={() => decrementItemCount(item.type, item.suitcase_id, item.count)}
                                  >
                                    −
                                  </button>
                                  <span className="count-display">{item.count}</span>
                                  <button 
                                    className="count-btn"
                                    onClick={() => incrementItemCount(item.type, item.suitcase_id)}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td>
                                <button 
                                  onClick={() => deleteItem(item.type, item.suitcase_id)} 
                                  className="delete-btn-small"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div 
                        className={`empty-items ${draggedItem ? 'drop-zone-active' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => handleDrop(e, 0, suitcase.id)}
                      >
                        No items in this suitcase yet. {draggedItem && <span className="drop-hint">Drop item here to add it</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="section">
            <h2>Search Items</h2>
            <div className="form">
              <input
                type="text"
                placeholder="Search by item type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button onClick={searchItems}>Search</button>
            </div>
            <div className="results">
              {searchResults.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Count</th>
                      <th>Suitcase</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map(item => (
                      <tr key={`${item.type}-${item.suitcase_id}`}>
                        <td>{item.type}</td>
                        <td>{item.count}</td>
                        <td>{item.suitcase_name}</td>
                        <td>
                          <button onClick={() => deleteItem(item.type, item.suitcase_id)} className="delete-btn">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : searchTerm ? (
                <p>No items found</p>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="section">
            <h2>Item Type Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Item Type</th>
                  <th>Total Count</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.type}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
