import jwt from 'jsonwebtoken';

/**
 * Middleware to authenticate requests using JSON Web Tokens (JWT).
 * Expects header format: "Authorization: Bearer <TOKEN>"
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <TOKEN>"

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('CRITICAL ERROR: JWT_SECRET is not defined in environment variables.');
    return res.status(500).json({ error: 'Internal auth configuration error' });
  }

  jwt.verify(token, jwtSecret, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }
    // Attach decoded user info ({ userId, email }) to request object
    req.user = decodedUser;
    next();
  });
}
