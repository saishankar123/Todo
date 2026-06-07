import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { connectDB, Todo, User } from './db.js';
import { authenticateToken } from './middleware/auth.js';

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

// Initialize Google OAuth2 Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Receives the Google credential ID token, verifies it, creates/retrieves the User,
 * and signs a custom JWT for application authentication.
 */
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google ID token (credential) is required' });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId || googleClientId === 'YOUR_GOOGLE_CLIENT_ID') {
      console.error('CRITICAL: GOOGLE_CLIENT_ID is not configured in .env');
      return res.status(500).json({ error: 'Server authentication misconfiguration' });
    }

    // Verify Google ID Token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email field is missing from Google profile' });
    }

    // Find or create the User in MongoDB
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        name,
        googleId,
        picture,
      });
      await user.save();
    } else if (!user.googleId) {
      // Update googleId if email already existed but was registered differently
      user.googleId = googleId;
      user.picture = picture;
      await user.save();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('CRITICAL: JWT_SECRET is not configured in .env');
      return res.status(500).json({ error: 'Server authentication misconfiguration' });
    }

    // Generate custom JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      jwtSecret,
      { expiresIn: '7d' } // Token expires in 7 days
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(401).json({ error: 'Invalid Google credential token' });
  }
});

/**
 * GET /api/todos
 * Retrieves all todo items belonging to the authenticated user, sorted by creation date descending.
 */
app.get('/api/todos', authenticateToken, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user.userId }).sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    console.error('Error retrieving todos:', error);
    res.status(500).json({ error: 'Failed to retrieve todos' });
  }
});

/**
 * POST /api/todos
 * Creates a new todo item for the authenticated user.
 */
app.post('/api/todos', authenticateToken, async (req, res) => {
  try {
    const { title, description, priority, category, dueDate } = req.body;
    
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    }

    const newTodo = new Todo({
      user: req.user.userId,
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
 * Updates an existing todo item belonging to the authenticated user.
 */
app.put('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category, completed, dueDate } = req.body;

    const todo = await Todo.findOne({ _id: id, user: req.user.userId });
    if (!todo) {
      return res.status(404).json({ error: 'Todo item not found or unauthorized' });
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
 * Deletes a todo item belonging to the authenticated user from MongoDB.
 */
app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Todo.findOneAndDelete({ _id: id, user: req.user.userId });
    
    if (!deleted) {
      return res.status(404).json({ error: 'Todo item not found or unauthorized' });
    }
    
    res.json({ message: 'Todo item deleted successfully', id });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

/**
 * GET /api/todos/stats
 * Aggregates dashboard analytics for the authenticated user's todos.
 */
app.get('/api/todos/stats', authenticateToken, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user.userId });
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

/**
 * GET /api/config/google-client-id
 * Returns the configured Google Client ID to the frontend.
 */
app.get('/api/config/google-client-id', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
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

