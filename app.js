const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const app = express();

app.use(express.json());
app.use(express.static('public')); 

app.set('views', './views');
app.set('view engine', 'ejs');

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

// Registration Page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Login Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Registration Route
app.post('/register', (req, res) => {
  const { username, password, email, cuisine, imageUrl } = req.body; 
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.serialize(() => {
    db.run(`
      INSERT INTO users (username, password, email, cuisine, imageUrl)
      VALUES (?, ?, ?, ?, ?)
    `, [username, hashedPassword, email, cuisine, imageUrl], function(err) { 
      if (err) {
        return res.status(500).send({ message: 'Error registering user' });
      }

      const userId = this.lastID; 

      db.get(`SELECT id FROM cuisines WHERE name = ?`, [cuisine], (err, row) => {
        if (err) {
          return res.status(500).send({ message: 'Error checking cuisine' });
        }

        if (row) {
          db.run(`INSERT INTO user_cuisines (user_id, cuisine_id) VALUES (?, ?)`, [userId, row.id], (err) => {
            if (err) {
              return res.status(500).send({ message: 'Error linking user to cuisine' });
            }
            res.send({ message: 'User registered successfully' });
          });
        } else {
          db.run(`INSERT INTO cuisines (name) VALUES (?)`, [cuisine], function(err) {
            if (err) {
              return res.status(500).send({ message: 'Error inserting cuisine' });
            }

            const cuisineId = this.lastID; 

            db.run(`INSERT INTO user_cuisines (user_id, cuisine_id) VALUES (?, ?)`, [userId, cuisineId], (err) => {
              if (err) {
                return res.status(500).send({ message: 'Error linking user to cuisine' });
              }
              res.send({ message: 'User registered successfully' });
            });
          });
        }
      });
    });
  });
});


// Login Route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.getUserByUsername(username, (err, user) => {
    if (err || !user) {
      res.status(401).send({ message: 'Invalid credentials' });
    } else {
      bcrypt.compare(password, user.password, (err, result) => {
        if (err) {
          res.status(500).send({ message: 'Error logging in' });
        } else if (!result) {
          res.status(401).send({ message: 'Invalid credentials' });
        } else {
          req.session.userId = user.id;
          res.send({ message: 'Login successful' });
        }
      });
    }
  });
});

// Middleware
const isLoggedIn = (req, res, next) => {
  if (!req.session.userId) {
    res.status(401).send('You must be logged in to access this page');
  } else {
    next();
  }
};

// Suggested Users Route
app.get('/suggested-users', isLoggedIn, (req, res) => {
  const userId = req.session.userId;
  db.suggestUsers(userId, (err, suggestedUsers) => {
    if (err) {
      res.status(500).send('Error retrieving suggested users');
    } else {
      res.render('suggested-users', { suggestedUsers });
    }
  });
});

app.listen(8008, () => {
  console.log('Server is running on http://localhost:8008');
});
