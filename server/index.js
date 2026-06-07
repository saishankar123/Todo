import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, Todo } from './db.js';

// Load environmental configuration variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('CRITICAL ERROR: MONGODB_URI is not defined in the environmental variables.');
  process.exit(1);
}

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());

// Open MongoDB Connection
connectDB(MONGODB_URI);

/**
 * GET /api/todos
 * Retrieves all todo items from MongoDB, sorted by creation date descending.
 */
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    console.error('Error retrieving todos:', error);
    res.status(500).json({ error: 'Failed to retrieve todos' });
  }
});

/**
 * POST /api/todos
 * Creates a new todo item in MongoDB.
 */
app.post('/api/todos', async (req, res) => {
  try {
    const { title, description, priority, category, dueDate } = req.body;
    
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    }

    const newTodo = new Todo({
      title: title.trim(),
      description: (description || '').trim(),
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      category: (category || 'personal').trim().toLowerCase(),
      dueDate: dueDate || null
    });

    await newTodo.save();
    res.status(201).json(newTodo);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

/**
 * PUT /api/todos/:id
 * Updates an existing todo item in MongoDB.
 */
app.put('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category, completed, dueDate } = req.body;

    const todo = await Todo.findById(id);
    if (!todo) {
      return res.status(404).json({ error: 'Todo item not found' });
    }

    // Update fields if provided
    if (title !== undefined) todo.title = title.trim();
    if (description !== undefined) todo.description = description.trim();
    if (priority !== undefined && ['low', 'medium', 'high'].includes(priority)) todo.priority = priority;
    if (category !== undefined) todo.category = category.trim().toLowerCase();
    if (dueDate !== undefined) todo.dueDate = dueDate;

    // Handle completed logic and timestamps
    if (completed !== undefined && completed !== todo.completed) {
      todo.completed = completed;
      todo.completedAt = completed ? new Date() : null;
    }

    await todo.save();
    res.json(todo);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

/**
 * DELETE /api/todos/:id
 * Deletes a todo item from MongoDB.
 */
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Todo.findByIdAndDelete(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Todo item not found' });
    }
    
    res.json({ message: 'Todo item deleted successfully', id });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

/**
 * GET /api/todos/stats
 * Aggregates dashboard analytics.
 */
app.get('/api/todos/stats', async (req, res) => {
  try {
    const todos = await Todo.find();
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byPriority = { low: 0, medium: 0, high: 0 };
    const byCategory = {};

    todos.forEach(t => {
      if (byPriority[t.priority] !== undefined) {
        byPriority[t.priority]++;
      }
      
      const cat = t.category || 'personal';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    res.json({
      total,
      completed,
      pending,
      completionRate,
      byPriority,
      byCategory
    });
  } catch (error) {
    console.error('Error calculating statistics:', error);
    res.status(500).json({ error: 'Failed to calculate statistics' });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static assets from the client build folder in production
app.use(express.static(path.join(__dirname, '../client/dist')));

// Wildcard route: Redirect any non-API request to index.html (client-side SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
