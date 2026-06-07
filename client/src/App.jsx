import { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Edit3, 
  Plus, 
  Search, 
  Calendar, 
  Tag, 
  AlertCircle, 
  SlidersHorizontal, 
  ListTodo, 
  X, 
  TrendingUp,
  Inbox,
  Sparkles,
  CalendarCheck,
  AlertTriangle
} from 'lucide-react';

function App() {
  // Application State
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  
  // Authentication State
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [googleClientId, setGoogleClientId] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // Search, Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'completed'
  const [filterPriority, setFilterPriority] = useState('all'); // 'all', 'low', 'medium', 'high'
  const [filterCategory, setFilterCategory] = useState('all'); // 'all' or custom
  const [sortBy, setSortBy] = useState('dueDate'); // 'dueDate', 'priority', 'createdAt'

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  
  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formCategory, setFormCategory] = useState('personal');
  const [formDueDate, setFormDueDate] = useState('');
  const [validationError, setValidationError] = useState('');

  // Fetch todos from Express backend
  const fetchTodos = async (activeToken) => {
    const apiToken = activeToken || token;
    if (!apiToken) return;

    try {
      const response = await fetch('/api/todos', {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const data = await response.json();
      setTodos(data);
      setIsOnline(true);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch todos:', err);
      setError('Could not connect to the backend server. Running in offline/read-only cache mode.');
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  };

  // Sync user info if token exists
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
  }, [token]);

  // Fetch Google Client ID on mount
  useEffect(() => {
    const fetchGoogleClientId = async () => {
      try {
        const response = await fetch('/api/config/google-client-id');
        const data = await response.json();
        setGoogleClientId(data.googleClientId);
      } catch (err) {
        console.error('Failed to load Google Client ID config:', err);
      } finally {
        setAuthLoading(false);
      }
    };
    fetchGoogleClientId();
  }, []);

  // Initialize Google Sign-In button
  useEffect(() => {
    if (token || !googleClientId) return;

    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleLoginSuccess
        });
        
        const container = document.getElementById("google-signin-btn");
        if (container) {
          window.google.accounts.id.renderButton(container, {
            theme: "outline",
            size: "large",
            width: 280,
            shape: "pill"
          });
        }
      }
    };

    if (!window.google) {
      const checkInterval = setInterval(() => {
        if (window.google) {
          clearInterval(checkInterval);
          initializeGoogleSignIn();
        }
      }, 200);
      return () => clearInterval(checkInterval);
    } else {
      initializeGoogleSignIn();
    }
  }, [token, googleClientId]);

  // Handle Google authentication success callback
  const handleGoogleLoginSuccess = async (googleResponse) => {
    try {
      setLoading(true);
      setError(null);
      
      const authRes = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: googleResponse.credential })
      });
      
      if (!authRes.ok) {
        const errorData = await authRes.json();
        throw new Error(errorData.error || 'Google Authentication failed');
      }
      
      const authData = await authRes.json();
      
      localStorage.setItem('token', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));
      
      setToken(authData.token);
      setUser(authData.user);
      setIsOnline(true);
      
      await fetchTodos(authData.token);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to authenticate with Google. Please try again.');
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  // Perform logout operations
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setTodos([]);
  };

  // Poll for changes when logged in
  useEffect(() => {
    if (token) {
      fetchTodos(token);
      const interval = setInterval(() => fetchTodos(token), 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Open modal for adding a new task
  const handleOpenAddModal = () => {
    setEditingTodo(null);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormCategory('personal');
    setFormDueDate('');
    setValidationError('');
    setIsModalOpen(true);
  };

  // Open modal for editing an existing task
  const handleOpenEditModal = (todo) => {
    setEditingTodo(todo);
    setFormTitle(todo.title);
    setFormDescription(todo.description || '');
    setFormPriority(todo.priority);
    setFormCategory(todo.category || 'personal');
    setFormDueDate(todo.dueDate ? todo.dueDate.split('T')[0] : '');
    setValidationError('');
    setIsModalOpen(true);
  };

  // Handle Create or Update submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setValidationError('Task title is required');
      return;
    }

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      priority: formPriority,
      category: formCategory.trim().toLowerCase() || 'personal',
      dueDate: formDueDate ? new Date(formDueDate).toISOString() : null
    };

    try {
      if (editingTodo) {
        // Update Action
        const response = await fetch(`/api/todos/${editingTodo.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to update task');
        const updated = await response.json();
        setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        // Create Action
        const response = await fetch('/api/todos', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to create task');
        const created = await response.json();
        setTodos(prev => [created, ...prev]);
      }
      setIsModalOpen(false);
      setValidationError('');
    } catch (err) {
      console.error(err);
      setValidationError('Connection lost. Action failed.');
    }
  };

  // Toggle Task Completion Status
  const handleToggleComplete = async (todo) => {
    const nextStatus = !todo.completed;
    try {
      // Optimistic Update
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: nextStatus, completedAt: nextStatus ? new Date().toISOString() : null } : t));

      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: nextStatus })
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle completion');
      }
      
      const updated = await response.json();
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err) {
      console.error(err);
      // Rollback on error
      setTodos(prev => prev.map(t => t.id === todo.id ? todo : t));
    }
  };

  // Delete a Task
  const handleDelete = async (id) => {
    try {
      // Optimistic Update
      const cachedTodos = [...todos];
      setTodos(prev => prev.filter(t => t.id !== id));

      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
    } catch (err) {
      console.error(err);
      // Restore on failure
      fetchTodos();
    }
  };

  // Dynamic Categories calculation for the sidebar filter
  const categoriesList = useMemo(() => {
    const list = new Set(['personal', 'work', 'shopping', 'ideas']);
    todos.forEach(todo => {
      if (todo.category) {
        list.add(todo.category.trim().toLowerCase());
      }
    });
    return Array.from(list);
  }, [todos]);

  // Real-time calculations for stats dashboard
  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Counter for active items overdue
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const overdue = todos.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due < now;
    }).length;

    return { total, completed, pending, completionRate, overdue };
  }, [todos]);

  // Filtering Logic
  const filteredTodos = useMemo(() => {
    return todos.filter(todo => {
      // 1. Search Query Match
      const matchesSearch = 
        todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        todo.description.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Status Match
      const matchesStatus = 
        filterStatus === 'all' ? true :
        filterStatus === 'active' ? !todo.completed :
        todo.completed;

      // 3. Priority Match
      const matchesPriority =
        filterPriority === 'all' ? true :
        todo.priority === filterPriority;

      // 4. Category Match
      const matchesCategory =
        filterCategory === 'all' ? true :
        todo.category === filterCategory;

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
  }, [todos, searchQuery, filterStatus, filterPriority, filterCategory]);

  // Sorting Logic
  const sortedTodos = useMemo(() => {
    const list = [...filteredTodos];
    
    list.sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      
      if (sortBy === 'priority') {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      
      if (sortBy === 'createdAt') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      
      return 0;
    });
    
    return list;
  }, [filteredTodos, sortBy]);

  // Helper: Format ISO date string into readable text
  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper: Check if a date string represents an overdue task
  const isOverdue = (dueDateStr) => {
    if (!dueDateStr) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    return due < now;
  };

  if (!token) {
    return (
      <div className="login-container animate-fade-in">
        {/* Abstract Glowing Background Blobs */}
        <div className="glow-blob blob-1"></div>
        <div className="glow-blob blob-2"></div>
        <div className="glow-blob blob-3"></div>

        <div className="glass-panel login-card">
          <div className="login-branding">
            <div className="logo-icon large animate-pulse">
              <ListTodo size={32} />
            </div>
            <h1 className="login-title">VeloTodo</h1>
            <p className="login-subtitle">Premium Task Orchestration Engine</p>
          </div>

          <div className="login-divider"></div>

          <div className="login-body">
            <p className="login-description">
              Securely orchestrate, filter, and track your daily priorities using Google OAuth 2.0 and JWT authorization.
            </p>

            {error && (
              <div className="login-error-message">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {authLoading ? (
              <div className="login-loading">Loading encryption keys...</div>
            ) : googleClientId ? (
              <div className="google-btn-wrapper">
                <div id="google-signin-btn"></div>
              </div>
            ) : (
              <div className="login-error-message">
                <AlertCircle size={16} />
                <span>Google Client ID is missing. Please set GOOGLE_CLIENT_ID on the backend server.</span>
              </div>
            )}
          </div>

          <div className="login-footer">
            <span>Secured with AES-256 equivalent JSON Web Tokens</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header Bar */}
      <header className="app-header">
        <div className="app-branding">
          <div className="logo-icon">
            <ListTodo size={22} />
          </div>
          <div className="branding-text">
            <h1 className="app-title">VeloTodo</h1>
            <span className="app-subtitle">Task Orchestrator v1.0</span>
          </div>
        </div>
        
        {/* User profile details and logout option */}
        {user && (
          <div className="user-profile-widget">
            <img className="user-avatar" src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}

        <div className="connection-status">
          <span className={`status-dot ${isOnline ? 'online' : ''}`}></span>
          <span>{isOnline ? 'Connected' : 'Offline Mode'}</span>
        </div>
      </header>

      {/* Analytics Dashboard Grid */}
      <section className="dashboard-grid animate-fade-in">
        <div className="glass-panel stat-card">
          <div className="stat-icon primary">
            <ListTodo size={20} />
          </div>
          <div className="stat-details">
            <h3>Total Tasks</h3>
            <div className="value">{stats.total}</div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon success">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-details">
            <h3>Completed</h3>
            <div className="value">{stats.completed}</div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon warning">
            <Inbox size={20} />
          </div>
          <div className="stat-details">
            <h3>Pending</h3>
            <div className="value">{stats.pending}</div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon danger">
            <AlertTriangle size={20} />
          </div>
          <div className="stat-details">
            <h3>Overdue</h3>
            <div className="value" style={{ color: stats.overdue > 0 ? 'var(--danger)' : 'inherit' }}>
              {stats.overdue}
            </div>
          </div>
        </div>
      </section>

      {/* Completion Progress Bar */}
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '1100px', marginBottom: '2rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completion Engine</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--success)' }}>{stats.completionRate}%</span>
        </div>
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${stats.completionRate}%` }}></div>
        </div>
      </div>

      {/* Main Panel Content Grid */}
      <main className="app-container">
        {/* Sidebar Controls */}
        <aside className="sidebar">
          <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ width: '100%' }}>
            <Plus size={18} /> Add New Task
          </button>

          {/* Search Section */}
          <div className="glass-panel sidebar-section">
            <h3 className="sidebar-section-title">Search</h3>
            <div className="search-wrapper">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                className="input-field search-input" 
                placeholder="Find tasks..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filters */}
          <div className="glass-panel sidebar-section">
            <h3 className="sidebar-section-title">Status Filter</h3>
            <ul className="filter-list">
              <li 
                className={`filter-item ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                <div className="filter-label-group">
                  <span>All Tasks</span>
                </div>
                <span className="filter-badge">{todos.length}</span>
              </li>
              <li 
                className={`filter-item ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                <div className="filter-label-group">
                  <span>Active</span>
                </div>
                <span className="filter-badge">{todos.filter(t => !t.completed).length}</span>
              </li>
              <li 
                className={`filter-item ${filterStatus === 'completed' ? 'active' : ''}`}
                onClick={() => setFilterStatus('completed')}
              >
                <div className="filter-label-group">
                  <span>Completed</span>
                </div>
                <span className="filter-badge">{todos.filter(t => t.completed).length}</span>
              </li>
            </ul>
          </div>

          {/* Priority Filters */}
          <div className="glass-panel sidebar-section">
            <h3 className="sidebar-section-title">Priority Filter</h3>
            <ul className="filter-list">
              <li 
                className={`filter-item ${filterPriority === 'all' ? 'active' : ''}`}
                onClick={() => setFilterPriority('all')}
              >
                <span>All Priorities</span>
                <span className="filter-badge">{todos.length}</span>
              </li>
              <li 
                className={`filter-item ${filterPriority === 'high' ? 'active' : ''}`}
                onClick={() => setFilterPriority('high')}
              >
                <span style={{ color: '#f87171' }}>High</span>
                <span className="filter-badge">{todos.filter(t => t.priority === 'high').length}</span>
              </li>
              <li 
                className={`filter-item ${filterPriority === 'medium' ? 'active' : ''}`}
                onClick={() => setFilterPriority('medium')}
              >
                <span style={{ color: '#fbbf24' }}>Medium</span>
                <span className="filter-badge">{todos.filter(t => t.priority === 'medium').length}</span>
              </li>
              <li 
                className={`filter-item ${filterPriority === 'low' ? 'active' : ''}`}
                onClick={() => setFilterPriority('low')}
              >
                <span style={{ color: '#60a5fa' }}>Low</span>
                <span className="filter-badge">{todos.filter(t => t.priority === 'low').length}</span>
              </li>
            </ul>
          </div>

          {/* Categories Filters */}
          <div className="glass-panel sidebar-section">
            <h3 className="sidebar-section-title">Category Filter</h3>
            <ul className="filter-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <li 
                className={`filter-item ${filterCategory === 'all' ? 'active' : ''}`}
                onClick={() => setFilterCategory('all')}
              >
                <span>All Categories</span>
                <span className="filter-badge">{todos.length}</span>
              </li>
              {categoriesList.map(cat => (
                <li 
                  key={cat}
                  className={`filter-item ${filterCategory === cat ? 'active' : ''}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                  <span className="filter-badge">{todos.filter(t => t.category === cat).length}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Task List Workspace */}
        <section className="main-content">
          <div className="panel-header">
            <div className="panel-title">
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              <span>
                {filterStatus === 'all' ? 'Workspace tasks' : filterStatus === 'active' ? 'Active Tasks' : 'Completed Archive'}
                {filterCategory !== 'all' && <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}> in {filterCategory}</span>}
              </span>
            </div>

            <div className="sort-controls">
              <SlidersHorizontal size={14} style={{ color: 'var(--text-dim)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort by</span>
              <select 
                className="select-field sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="dueDate">Due Date</option>
                <option value="priority">Priority Weight</option>
                <option value="createdAt">Date Created</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
              <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Fetching task index from api...</div>
            </div>
          ) : sortedTodos.length > 0 ? (
            <div className="todo-list">
              {sortedTodos.map(todo => {
                const overdue = !todo.completed && isOverdue(todo.dueDate);
                return (
                  <div key={todo.id} className={`glass-panel todo-card ${todo.completed ? 'completed' : ''}`}>
                    <div className="todo-checkbox-wrapper">
                      <button 
                        className={`checkbox-btn ${todo.completed ? 'checked' : ''}`}
                        onClick={() => handleToggleComplete(todo)}
                        title={todo.completed ? 'Mark Active' : 'Mark Completed'}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    </div>

                    <div className="todo-content">
                      <h4 className="todo-title" title={todo.title}>{todo.title}</h4>
                      {todo.description && <p className="todo-desc">{todo.description}</p>}
                      
                      <div className="todo-meta">
                        <span className={`badge badge-priority-${todo.priority}`}>
                          {todo.priority}
                        </span>
                        
                        <span className="badge badge-category">
                          <Tag size={10} /> {todo.category || 'personal'}
                        </span>

                        {todo.dueDate && (
                          <span className={`badge badge-due-date ${overdue ? 'overdue' : ''}`}>
                            <Calendar size={10} /> 
                            {formatDate(todo.dueDate)}
                            {overdue && ' (Overdue)'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="todo-actions">
                      <button 
                        className="btn-icon-only edit" 
                        onClick={() => handleOpenEditModal(todo)}
                        title="Edit Details"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        className="btn-icon-only danger" 
                        onClick={() => handleDelete(todo.id)}
                        title="Delete Task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-panel empty-state">
              <Inbox size={42} />
              <div className="empty-state-title">No Tasks Found</div>
              <p className="empty-state-desc">
                {searchQuery || filterCategory !== 'all' || filterPriority !== 'all' || filterStatus !== 'all'
                  ? 'No tasks match your selected filters. Try clearing some criteria.'
                  : 'Start your workflow by adding a task using the "Add New Task" button.'}
              </p>
              {(searchQuery || filterCategory !== 'all' || filterPriority !== 'all' || filterStatus !== 'all') && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('all');
                    setFilterPriority('all');
                    setFilterStatus('all');
                  }}
                  style={{ marginTop: '0.5rem' }}
                >
                  Reset All Filters
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Edit / Add Modal Form */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingTodo ? 'Edit Task Workspace' : 'Assemble New Task'}</h3>
              <button className="btn-icon-only" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Task Header *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="What is the objective?" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-group">
                <label>Context / Description</label>
                <textarea 
                  className="textarea-field" 
                  placeholder="Outline minor goals, guidelines, or reference links..." 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority Weight</label>
                  <select 
                    className="select-field" 
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Due Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Category Label</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Type or select a category tag..." 
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    maxLength={30}
                  />
                </div>
                {/* Category Quick Selector Badges */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {['personal', 'work', 'shopping', 'ideas'].map(cat => (
                    <button 
                      key={cat} 
                      type="button" 
                      className={`badge badge-category`} 
                      style={{ 
                        cursor: 'pointer',
                        background: formCategory.toLowerCase() === cat ? 'var(--primary-glow)' : 'transparent',
                        borderColor: formCategory.toLowerCase() === cat ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)'
                      }}
                      onClick={() => setFormCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {validationError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f87171', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 600 }}>
                  <AlertCircle size={14} />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTodo ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
