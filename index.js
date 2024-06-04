const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = 3001;

// Включаем cors
app.use(cors());

// Подключение к базе данных
const db = new sqlite3.Database('./user_data.db');

// Middleware для обработки JSON-запросов
app.use(express.json());

// Получение всех данных пользователей с пагинацией
// Получение всех данных пользователей с пагинацией
app.get('/api/users', (req, res) => {
  const { page = 1, limit = 10 } = req.query; // Получаем параметры page и limit из запроса
  const offset = (page - 1) * limit;

  db.all('SELECT * FROM user_data ORDER BY timestamp DESC LIMIT ? OFFSET ?', [limit, offset], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT COUNT(*) AS count FROM user_data', (err, countRow) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const totalCount = countRow.count;
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        data: rows,
        meta: {
          totalCount,
          totalPages,
          currentPage: page,
          perPage: limit
        }
      });
    });
  });
});

// Получение данных пользователя по userId
app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  db.get('SELECT * FROM user_data WHERE userId = ?', [userId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ data: row });
  });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`API server is running on http://localhost:${port}`);
});
