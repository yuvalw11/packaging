import React, { useState, useEffect } from 'react';
import './App.css';

// API endpoint configuration for dynamic API calls
// Static assets (CSS, JS, images) are configured via PUBLIC_URL at build time
const API_URL = process.env.REACT_APP_API_URL || '/api';

function App() {
  const [suitcases, setSuitcases] = useState([]);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('manage');
  
  // Form states
  const [newItemType, setNewItemType] = useState('');
  const [newItemCount, setNewItemCount] = useState(1);
  const [newItemCategory, setNewItemCategory] = useState('');
  const [selectedSuitcase, setSelectedSuitcase] = useState('');
  const [newSuitcaseName, setNewSuitcaseName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [activeSuitcaseForAdding, setActiveSuitcaseForAdding] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggedSuitcase, setDraggedSuitcase] = useState(null);
  const [dragOverSuitcaseIndex, setDragOverSuitcaseIndex] = useState(null);
  const [collapsedSuitcases, setCollapsedSuitcases] = useState(new Set());
  const [editingType, setEditingType] = useState(null); // { type, suitcase_id }
  const [editingCategory, setEditingCategory] = useState(null); // { type, suitcase_id }
  const [editItemType, setEditItemType] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [showEditSuggestions, setShowEditSuggestions] = useState(false);
  const [showEditCategorySuggestions, setShowEditCategorySuggestions] = useState(false);
  
  // Mobile item card collapse state (tracks expanded items, all others are collapsed by default)
  const [expandedMobileItems, setExpandedMobileItems] = useState(new Set());
  const [expandedMobileSummaryItems, setExpandedMobileSummaryItems] = useState(new Set());
  
  // Summary filtering and sorting states
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('type'); // 'type', 'category', 'count'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Refs to track if we're selecting from dropdown (to prevent blur from saving)
  const selectingFromTypeDropdown = React.useRef(false);
  const selectingFromCategoryDropdown = React.useRef(false);

  // Get unique item types for autocomplete
  const uniqueItemTypes = [...new Set(items.map(item => item.type))].sort();
  const uniqueCategoryNames = [...new Set(categories.map(cat => cat.name))].sort();

  useEffect(() => {
    fetchSuitcases();
    fetchItems();
    fetchSummary();
    fetchCategories();
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

  const fetchCategories = async () => {
    const res = await fetch(`${API_URL}/categories`);
    const data = await res.json();
    setCategories(data);
  };

  const addItem = async (e, suitcaseId) => {
    e.preventDefault();
    if (!newItemType || !suitcaseId) return;
    
    await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newItemType, count: newItemCount, category: newItemCategory, suitcase_id: suitcaseId })
    });
    
    setNewItemType('');
    setNewItemCount(1);
    setNewItemCategory('');
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

  const searchItems = async (term) => {
    setSearchTerm(term);
    if (!term) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`${API_URL}/items/search?type=${term}`);
    const data = await res.json();
    setSearchResults(data);
  };

  const handleItemTypeChange = (value) => {
    setNewItemType(value);
    setShowSuggestions(value.length > 0);
    
    // Auto-populate category if the item type exists
    const existingItem = items.find(item => item.type.toLowerCase() === value.toLowerCase());
    if (existingItem && existingItem.category_name) {
      setNewItemCategory(existingItem.category_name);
    }
  };

  const selectSuggestion = (suggestion) => {
    setNewItemType(suggestion);
    setShowSuggestions(false);
    
    // Auto-populate category when selecting from dropdown
    const existingItem = items.find(item => item.type === suggestion);
    if (existingItem && existingItem.category_name) {
      setNewItemCategory(existingItem.category_name);
    }
  };

  const getFilteredSuggestions = () => {
    if (!newItemType) return [];
    return uniqueItemTypes.filter(type => 
      type.toLowerCase().includes(newItemType.toLowerCase())
    );
  };

  const handleDragStart = (e, item, index, suitcaseId) => {
    e.stopPropagation(); // Prevent suitcase drag from triggering
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
      // Move the item to the new suitcase at the specified position
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

  const handleDragEnd = (e) => {
    e.stopPropagation(); // Prevent suitcase drag from triggering
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  // Suitcase collapse/expand handlers
  const toggleSuitcaseCollapse = (suitcaseId) => {
    setCollapsedSuitcases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suitcaseId)) {
        newSet.delete(suitcaseId);
      } else {
        newSet.add(suitcaseId);
      }
      return newSet;
    });
  };

  const collapseAllSuitcases = () => {
    const allSuitcaseIds = new Set(suitcases.map(s => s.id));
    setCollapsedSuitcases(allSuitcaseIds);
  };

  const expandAllSuitcases = () => {
    setCollapsedSuitcases(new Set());
  };

  // Mobile item card collapse toggle
  const toggleMobileItemCollapse = (itemKey) => {
    setExpandedMobileItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey);
      } else {
        newSet.add(itemKey);
      }
      return newSet;
    });
  };

  // Mobile summary item card collapse toggle
  const toggleMobileSummaryItemCollapse = (itemKey) => {
    setExpandedMobileSummaryItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey);
      } else {
        newSet.add(itemKey);
      }
      return newSet;
    });
  };

  // Suitcase drag and drop handlers
  const handleSuitcaseDragStart = (e, suitcase, index) => {
    setDraggedSuitcase({ suitcase, index });
    e.dataTransfer.effectAllowed = 'move';
    
    // Collapse all suitcases when starting to drag
    const allSuitcaseIds = new Set(suitcases.map(s => s.id));
    setCollapsedSuitcases(allSuitcaseIds);
  };

  const handleSuitcaseDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSuitcaseIndex(index);
  };

  const handleSuitcaseDragLeave = () => {
    setDragOverSuitcaseIndex(null);
  };

  const handleSuitcaseDrop = async (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedSuitcase || draggedSuitcase.index === dropIndex) {
      setDraggedSuitcase(null);
      setDragOverSuitcaseIndex(null);
      return;
    }
    
    // Reorder suitcases array
    const newSuitcases = [...suitcases];
    const [movedSuitcase] = newSuitcases.splice(draggedSuitcase.index, 1);
    newSuitcases.splice(dropIndex, 0, movedSuitcase);
    
    // Update positions
    const updates = newSuitcases.map((suitcase, index) => ({
      id: suitcase.id,
      position: index
    }));
    
    await fetch(`${API_URL}/suitcases/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suitcases: updates })
    });
    
    setDraggedSuitcase(null);
    setDragOverSuitcaseIndex(null);
    await fetchSuitcases();
  };

  const handleSuitcaseDragEnd = () => {
    setDraggedSuitcase(null);
    setDragOverSuitcaseIndex(null);
  };

  const startEditingType = (item) => {
    setEditingType({ type: item.type, suitcase_id: item.suitcase_id });
    setEditItemType(item.type);
    setShowEditSuggestions(false);
  };

  const startEditingCategory = (item) => {
    setEditingCategory({ type: item.type, suitcase_id: item.suitcase_id });
    setEditItemCategory(item.category_name || '');
    setShowEditCategorySuggestions(false);
  };

  const saveItemType = async (oldType, newTypeOverride = null) => {
    const newType = newTypeOverride || editItemType;
    
    if (!newType || newType === oldType) {
      setEditingType(null);
      setEditItemType('');
      return;
    }

    await fetch(`${API_URL}/items/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        oldType: oldType, 
        newType: newType
      })
    });

    setEditingType(null);
    setEditItemType('');
    await fetchItems();
    await fetchSummary();
    await fetchCategories();
  };

  const saveItemCategory = async (itemType, oldCategory, newCategoryOverride = null) => {
    const newCategory = newCategoryOverride !== null ? newCategoryOverride : editItemCategory;
    
    if (newCategory === (oldCategory || '')) {
      setEditingCategory(null);
      setEditItemCategory('');
      return;
    }

    await fetch(`${API_URL}/item-types/${encodeURIComponent(itemType)}/category`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        category: newCategory || ''
      })
    });

    setEditingCategory(null);
    setEditItemCategory('');
    await fetchItems();
    await fetchSummary();
    await fetchCategories();
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

  const handleCategoryChange = (value) => {
    setNewItemCategory(value);
    setShowCategorySuggestions(value.length > 0);
  };

  const selectCategorySuggestion = (suggestion) => {
    setNewItemCategory(suggestion);
    setShowCategorySuggestions(false);
  };

  const getFilteredCategorySuggestions = () => {
    if (!newItemCategory) return uniqueCategoryNames;
    return uniqueCategoryNames.filter(cat => 
      cat.toLowerCase().includes(newItemCategory.toLowerCase())
    );
  };

  const handleEditCategoryChange = (value) => {
    setEditItemCategory(value);
    setShowEditCategorySuggestions(true);
  };

  const selectEditCategorySuggestion = (suggestion) => {
    setEditItemCategory(suggestion);
    setShowEditCategorySuggestions(false);
  };

  const getFilteredEditCategorySuggestions = () => {
    if (!editItemCategory) return uniqueCategoryNames;
    return uniqueCategoryNames.filter(cat => 
      cat.toLowerCase().includes(editItemCategory.toLowerCase())
    );
  };

  const moveItemToSuitcase = async (itemType, fromSuitcaseId, toSuitcaseId) => {
    if (fromSuitcaseId === toSuitcaseId) return;
    
    await fetch(`${API_URL}/items/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: itemType,
        from_suitcase_id: fromSuitcaseId,
        to_suitcase_id: toSuitcaseId,
        position: 999 // Add to end
      })
    });
    
    await fetchItems();
    await fetchSummary();
  };

  const exportData = async () => {
    try {
      const res = await fetch(`${API_URL}/export`);
      const data = await res.json();
      
      // Create a blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `packing-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting data: ' + error.message);
    }
  };

  const importData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!window.confirm('This will replace all current data. Are you sure?')) {
        event.target.value = '';
        return;
      }

      const res = await fetch(`${API_URL}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      
      if (result.success) {
        alert(`Successfully imported ${result.imported.suitcases} suitcases and ${result.imported.items} items!`);
        await fetchSuitcases();
        await fetchItems();
        await fetchSummary();
      } else {
        alert('Import failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error importing data: ' + error.message);
    }
    
    event.target.value = '';
  };

  // Filter and sort summary data
  const getFilteredAndSortedSummary = () => {
    let filtered = [...summary];
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'none') {
        filtered = filtered.filter(item => !item.category_name);
      } else {
        filtered = filtered.filter(item => item.category_name === categoryFilter);
      }
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let compareA, compareB;
      
      switch (sortBy) {
        case 'type':
          compareA = a.type.toLowerCase();
          compareB = b.type.toLowerCase();
          break;
        case 'category':
          compareA = (a.category_name || '').toLowerCase();
          compareB = (b.category_name || '').toLowerCase();
          break;
        case 'count':
          compareA = a.count;
          compareB = b.count;
          break;
        default:
          return 0;
      }
      
      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  };

  const handleSortClick = (column) => {
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortBy(column);
      setSortOrder('asc');
    }
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
        <div className="header-actions">
          <button onClick={exportData} className="export-btn">
            📥 Export Data
          </button>
          <label className="import-btn">
            📤 Import Data
            <input
              type="file"
              accept=".json"
              onChange={importData}
              style={{ display: 'none' }}
            />
          </label>
        </div>
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

            <div className="suitcases-header">
              <h2>Your Suitcases</h2>
              {suitcases.length > 0 && (
                <div className="collapse-all-controls">
                  <button 
                    onClick={collapseAllSuitcases}
                    className="collapse-all-btn"
                    title="Collapse all suitcases"
                  >
                    ▲ Collapse All
                  </button>
                  <button 
                    onClick={expandAllSuitcases}
                    className="expand-all-btn"
                    title="Expand all suitcases"
                  >
                    ▼ Expand All
                  </button>
                </div>
              )}
            </div>
            {suitcases.length === 0 ? (
              <p className="empty-message">No suitcases yet. Add one above to get started!</p>
            ) : (
              suitcases.map((suitcase, index) => {
                const suitcaseItems = items.filter(item => item.suitcase_id === suitcase.id);
                const isAdding = activeSuitcaseForAdding === suitcase.id;
                const isCollapsed = collapsedSuitcases.has(suitcase.id);
                
                return (
                  <div 
                    key={suitcase.id} 
                    className={`suitcase-card ${
                      draggedSuitcase?.index === index ? 'dragging-suitcase' : ''
                    } ${
                      dragOverSuitcaseIndex === index && draggedSuitcase?.index !== index ? 'drag-over-suitcase' : ''
                    }`}
                    draggable
                    onDragStart={(e) => handleSuitcaseDragStart(e, suitcase, index)}
                    onDragOver={(e) => handleSuitcaseDragOver(e, index)}
                    onDragLeave={handleSuitcaseDragLeave}
                    onDrop={(e) => handleSuitcaseDrop(e, index)}
                    onDragEnd={handleSuitcaseDragEnd}
                  >
                    <div className="suitcase-header">
                      <div className="suitcase-title">
                        <span className="suitcase-drag-handle">⋮⋮</span>
                        <h3>{suitcase.name}</h3>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSuitcaseCollapse(suitcase.id);
                          }}
                          className="collapse-btn"
                          title={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                          {isCollapsed ? '▼' : '▲'}
                        </button>
                      </div>
                      <div className="suitcase-actions">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSuitcaseForAdding(isAdding ? null : suitcase.id);
                          }} 
                          className="add-item-btn"
                        >
                          {isAdding ? 'Close' : '+ Add Item'}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSuitcase(suitcase.id);
                          }} 
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && isAdding && (
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
                        <div className="autocomplete-wrapper">
                          <input
                            type="text"
                            placeholder="Category (optional)"
                            value={newItemCategory}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            onFocus={() => setShowCategorySuggestions(true)}
                            onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)}
                            autoComplete="off"
                            className="category-input"
                          />
                          {showCategorySuggestions && getFilteredCategorySuggestions().length > 0 && (
                            <div className="suggestions-dropdown">
                              {getFilteredCategorySuggestions().map((suggestion, idx) => (
                                <div 
                                  key={idx} 
                                  className="suggestion-item"
                                  onClick={() => selectCategorySuggestion(suggestion)}
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

                    {!isCollapsed && suitcaseItems.length > 0 ? (
                      <div>
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th width="40"></th>
                              <th>Item Type</th>
                              <th>Category</th>
                              <th>Count</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {suitcaseItems.map((item, index) => {
                              const itemKey = `${item.type}-${item.suitcase_id}`;
                              const isItemCollapsed = !expandedMobileItems.has(itemKey);
                              
                              return (
                            <tr 
                              key={itemKey}
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
                                ${isItemCollapsed ? 'mobile-collapsed' : ''}
                              `}
                              data-mobile-summary={`${item.type} • ${item.category_name || 'No category'} • ${item.count}x`}
                              onClick={(e) => {
                                // Only toggle on mobile when clicking the card itself (not buttons, inputs, or editable fields)
                                if (window.innerWidth <= 768 && !e.target.closest('button, select, input, .editable-item-name')) {
                                  toggleMobileItemCollapse(itemKey);
                                }
                              }}
                            >
                              <td className="drag-handle">
                                <span className="drag-icon">⋮⋮</span>
                              </td>
                              <td data-label="Item Type">
                                {editingType?.type === item.type && editingType?.suitcase_id === item.suitcase_id ? (
                                  <div className="autocomplete-wrapper">
                                    <input
                                      type="text"
                                      value={editItemType}
                                      onChange={(e) => handleEditItemTypeChange(e.target.value)}
                                      onFocus={() => setShowEditSuggestions(editItemType.length > 0)}
                                      onBlur={() => {
                                        // Only save if we're not selecting from dropdown
                                        if (!selectingFromTypeDropdown.current) {
                                          setShowEditSuggestions(false);
                                          saveItemType(item.type);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          selectingFromTypeDropdown.current = false;
                                          saveItemType(item.type);
                                        } else if (e.key === 'Escape') {
                                          selectingFromTypeDropdown.current = false;
                                          setEditingType(null);
                                          setEditItemType('');
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
                                            onMouseDown={() => {
                                              selectingFromTypeDropdown.current = true;
                                              setEditItemType(suggestion);
                                              setShowEditSuggestions(false);
                                              saveItemType(item.type, suggestion);
                                            }}
                                            onMouseUp={() => {
                                              selectingFromTypeDropdown.current = false;
                                            }}
                                          >
                                            {suggestion}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span 
                                    onClick={() => startEditingType(item)}
                                    className="editable-item-name"
                                    title="Click to edit"
                                  >
                                    {item.type}
                                  </span>
                                )}
                              </td>
                              <td data-label="Category">
                                {editingCategory?.type === item.type && editingCategory?.suitcase_id === item.suitcase_id ? (
                                  <div className="autocomplete-wrapper">
                                    <input
                                      type="text"
                                      value={editItemCategory}
                                      onChange={(e) => handleEditCategoryChange(e.target.value)}
                                      onFocus={() => setShowEditCategorySuggestions(true)}
                                      onBlur={() => {
                                        // Only save if we're not selecting from dropdown
                                        if (!selectingFromCategoryDropdown.current) {
                                          setShowEditCategorySuggestions(false);
                                          saveItemCategory(item.type, item.category_name);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          selectingFromCategoryDropdown.current = false;
                                          saveItemCategory(item.type, item.category_name);
                                        } else if (e.key === 'Escape') {
                                          selectingFromCategoryDropdown.current = false;
                                          setEditingCategory(null);
                                          setEditItemCategory('');
                                        }
                                      }}
                                      placeholder="Category"
                                      autoComplete="off"
                                      autoFocus
                                      className="edit-input"
                                    />
                                    {showEditCategorySuggestions && getFilteredEditCategorySuggestions().length > 0 && (
                                      <div className="suggestions-dropdown">
                                        {getFilteredEditCategorySuggestions().map((suggestion, idx) => (
                                          <div 
                                            key={idx} 
                                            className="suggestion-item"
                                            onMouseDown={() => {
                                              selectingFromCategoryDropdown.current = true;
                                              setEditItemCategory(suggestion);
                                              setShowEditCategorySuggestions(false);
                                              saveItemCategory(item.type, item.category_name, suggestion);
                                            }}
                                            onMouseUp={() => {
                                              selectingFromCategoryDropdown.current = false;
                                            }}
                                          >
                                            {suggestion}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span 
                                    onClick={() => startEditingCategory(item)}
                                    className="editable-item-name"
                                    title="Click to edit (affects all instances of this item type)"
                                    style={{
                                      backgroundColor: item.category_color || 'transparent',
                                      color: item.category_color ? '#fff' : 'inherit',
                                      padding: item.category_color ? '4px 8px' : '0',
                                      borderRadius: item.category_color ? '4px' : '0',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {item.category_name || '-'}
                                  </span>
                                )}
                              </td>
                              <td data-label="Count">
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
                              <td data-label="Actions">
                                <div className="action-controls">
                                  <select 
                                    className="move-select"
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        moveItemToSuitcase(item.type, item.suitcase_id, parseInt(e.target.value));
                                        e.target.value = '';
                                      }
                                    }}
                                    defaultValue=""
                                  >
                                    <option value="" disabled>Move to...</option>
                                    {suitcases
                                      .filter(s => s.id !== suitcase.id)
                                      .map(s => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))
                                    }
                                  </select>
                                  <button 
                                    onClick={() => deleteItem(item.type, item.suitcase_id)} 
                                    className="delete-btn-small"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div 
                          className={`drop-zone-bottom ${draggedItem && draggedItem.suitcaseId !== suitcase.id ? 'drop-zone-active' : ''}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => handleDrop(e, suitcaseItems.length, suitcase.id)}
                        >
                          {draggedItem && draggedItem.suitcaseId !== suitcase.id && <span className="drop-hint">Drop here to add to end</span>}
                        </div>
                      </div>
                    ) : !isCollapsed && suitcaseItems.length === 0 ? (
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
                    ) : null}
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
                onChange={(e) => searchItems(e.target.value)}
              />
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
                        <td data-label="Type">{item.type}</td>
                        <td data-label="Count">{item.count}</td>
                        <td data-label="Suitcase">{item.suitcase_name}</td>
                        <td data-label="Action">
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
            
            <div className="summary-controls">
              <div className="filter-group">
                <label htmlFor="category-filter">Filter by Category:</label>
                <select 
                  id="category-filter"
                  value={categoryFilter} 
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="category-filter-select"
                >
                  <option value="all">All Categories</option>
                  <option value="none">No Category</option>
                  {uniqueCategoryNames.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="sort-group">
                <label htmlFor="sort-by">Sort by:</label>
                <select 
                  id="sort-by"
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="type">Item Type</option>
                  <option value="category">Category</option>
                  <option value="count">Count</option>
                </select>
                <button 
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="sort-order-btn"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
              
              <div className="summary-info">
                Showing {getFilteredAndSortedSummary().length} of {summary.length} items
              </div>
            </div>

            <table className="summary-table">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSortClick('type')}
                    className={`sortable ${sortBy === 'type' ? 'sorted' : ''}`}
                  >
                    Item Type {sortBy === 'type' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th 
                    onClick={() => handleSortClick('category')}
                    className={`sortable ${sortBy === 'category' ? 'sorted' : ''}`}
                  >
                    Category {sortBy === 'category' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th 
                    onClick={() => handleSortClick('count')}
                    className={`sortable ${sortBy === 'count' ? 'sorted' : ''}`}
                  >
                    Count {sortBy === 'count' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {getFilteredAndSortedSummary().map((item, idx) => {
                  const itemKey = `${item.type}`;
                  const isItemCollapsed = !expandedMobileSummaryItems.has(itemKey);
                  
                  return (
                  <tr 
                    key={idx}
                    className={isItemCollapsed ? 'mobile-collapsed' : ''}
                    data-mobile-summary={`${item.type} • ${item.category_name || 'No category'} • ${item.count}x`}
                    onClick={(e) => {
                      // Only toggle on mobile when clicking the card itself
                      if (window.innerWidth <= 768 && !e.target.closest('button, select, input')) {
                        toggleMobileSummaryItemCollapse(itemKey);
                      }
                    }}
                  >
                    <td data-label="Item Type">{item.type}</td>
                    <td data-label="Category">
                      {item.category_name ? (
                        <span
                          style={{
                            backgroundColor: item.category_color || 'transparent',
                            color: item.category_color ? '#fff' : 'inherit',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}
                        >
                          {item.category_name}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td data-label="Count">{item.count}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
