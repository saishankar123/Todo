import mongoose from 'mongoose';

// Define the Schema for User Accounts
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  name: { 
    type: String,
    trim: true
  },
  googleId: { 
    type: String, 
    required: true,
    unique: true
  },
  picture: { 
    type: String,
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const User = mongoose.model('User', userSchema);

// Define the Schema for Todo Tasks
const todoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Set to false to support migration of legacy data
  },
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    default: '', 
    trim: true 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  },
  category: { 
    type: String, 
    default: 'personal', 
    lowercase: true, 
    trim: true 
  },
  completed: { 
    type: Boolean, 
    default: false 
  },
  dueDate: { 
    type: Date, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  completedAt: { 
    type: Date, 
    default: null 
  }
});

// Configure client compatibility: map MongoDB _id to virtual id property.
// This ensures the frontend doesn't need to change.
todoSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

todoSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Todo = mongoose.model('Todo', todoSchema);

/**
 * Connects to MongoDB with the given URI
 */
export async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export { Todo, User };

