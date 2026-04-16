const http = require('http');
const url = require('url');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3011;
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: 'marklike123',
  database: 'marklike',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const PREMIUM_DIR = '/www/server/data/marklike_premium';

const pool = mysql.createPool(DB_CONFIG);

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(data));
}

function sendError(res, code, message) {
  sendJSON(res, code, { error: message });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(); return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const queryParams = parsedUrl.query;

  try {
    // Health check
    if (pathname === '/api/health') {
      sendJSON(res, 200, { status: 'ok' });
      return;
    }

    // Get premium slices (from JSON files)
    if (pathname === '/api/premium' && req.method === 'GET') {
      const page = parseInt(queryParams.page) || 1;
      const limit = parseInt(queryParams.limit) || 20;

      // Get all JSON files
      let files = [];
      try {
        files = fs.readdirSync(PREMIUM_DIR).filter(f => f.endsWith('.json'));
      } catch (e) {
        sendJSON(res, 200, { slices: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        return;
      }

      // Sort by id descending
      files.sort((a, b) => parseInt(b.replace('.json', '')) - parseInt(a.replace('.json', '')));

      const total = files.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const end = start + limit;
      const pageFiles = files.slice(start, end);

      // Read page files
      const slices = pageFiles.map(f => {
        try {
          const content = fs.readFileSync(path.join(PREMIUM_DIR, f), 'utf-8');
          const data = JSON.parse(content);
          return {
            id: data.id,
            title: data.source,
            content: data.original,
            modern: data.modern,
            english: data.english,
            source: data.source,
            genre: data.genre,
            word_count: data.word_count
          };
        } catch (e) {
          return null;
        }
      }).filter(s => s !== null);

      sendJSON(res, 200, {
        slices,
        pagination: { page, limit, total, totalPages }
      });
      return;
    }

    // Get single premium slice
    if (pathname.match(/^\/api\/premium\/\d+$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const filePath = path.join(PREMIUM_DIR, `${id}.json`);

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          sendJSON(res, 200, { slice: data });
          return;
        } catch (e) {
          sendError(res, 404, 'Invalid JSON');
          return;
        }
      }
      sendError(res, 404, 'Premium slice not found');
      return;
    }

    // Get all public slices with pagination (original)
    if (pathname === '/api/slices' && req.method === 'GET') {
      const page = parseInt(queryParams.page) || 1;
      const limit = parseInt(queryParams.limit) || 20;
      const offset = (page - 1) * limit;

      const [slices, countResult] = await Promise.all([
        query('SELECT id, title, LEFT(content, 500) as content_preview, source, created_at FROM literary_slice WHERE is_public = 1 ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]),
        query('SELECT COUNT(*) as total FROM literary_slice WHERE is_public = 1')
      ]);

      const total = countResult[0].total;
      sendJSON(res, 200, {
        slices,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
      return;
    }

    // Get single slice
    if (pathname.match(/^\/api\/slice\/\d+$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const [slice] = await query('SELECT * FROM literary_slice WHERE id = ?', [id]);
      if (!slice) { sendError(res, 404, 'Slice not found'); return; }
      sendJSON(res, 200, { slice });
      return;
    }

    // Get all books
    if (pathname === '/api/books' && req.method === 'GET') {
      const books = await query('SELECT id, name as title, slice_count, processed_at as created_at FROM processed_books ORDER BY id DESC');
      sendJSON(res, 200, { books });
      return;
    }

    // Get slices by book
    if (pathname.match(/^\/api\/book\/\d+\/slices$/) && req.method === 'GET') {
      const bookId = pathname.split('/')[4];
      const page = parseInt(queryParams.page) || 1;
      const limit = parseInt(queryParams.limit) || 20;
      const offset = (page - 1) * limit;

      const [slices, countResult] = await Promise.all([
        query('SELECT id, title, LEFT(content, 500) as content_preview, source, created_at FROM literary_slice WHERE source LIKE ? ORDER BY id LIMIT ? OFFSET ?', [`%${bookId}%`, limit, offset]),
        query('SELECT COUNT(*) as total FROM literary_slice WHERE source LIKE ?', [`%${bookId}%`])
      ]);

      sendJSON(res, 200, {
        slices,
        pagination: { page, limit, total: countResult[0].total }
      });
      return;
    }

    // User login
    if (pathname === '/api/login' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const { username, password } = JSON.parse(body);
          const [user] = await query('SELECT id, username, email, is_vip, vip_expire_at FROM user WHERE username = ? AND password = ?', [username, password]);
          if (!user) { sendError(res, 401, 'Invalid credentials'); return; }
          sendJSON(res, 200, { user });
        } catch (e) { sendError(res, 400, 'Invalid request'); }
      });
      return;
    }

    // User register
    if (pathname === '/api/register' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const { username, password, email } = JSON.parse(body);
          await query('INSERT INTO user (username, password, email) VALUES (?, ?, ?)', [username, password, email]);
          sendJSON(res, 201, { message: 'User created' });
        } catch (e) { sendError(res, 400, e.code === 'ER_DUP_ENTRY' ? 'Username or email exists' : 'Registration failed'); }
      });
      return;
    }

    // Get user info
    if (pathname.match(/^\/api\/user\/\d+$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const [user] = await query('SELECT id, username, email, is_vip, vip_expire_at, created_at FROM user WHERE id = ?', [id]);
      if (!user) { sendError(res, 404, 'User not found'); return; }
      sendJSON(res, 200, { user });
      return;
    }

    // Statistics
    if (pathname === '/api/stats' && req.method === 'GET') {
      const [sliceCount] = await query('SELECT COUNT(*) as count FROM literary_slice WHERE is_public = 1');
      const [bookCount] = await query('SELECT COUNT(*) as count FROM processed_books');
      const [userCount] = await query('SELECT COUNT(*) as count FROM user');

      // Count premium files
      let premiumCount = 0;
      try {
        premiumCount = fs.readdirSync(PREMIUM_DIR).filter(f => f.endsWith('.json')).length;
      } catch (e) {}

      sendJSON(res, 200, { slices: sliceCount.count, books: bookCount.count, users: userCount.count, premium: premiumCount });
      return;
    }

    sendError(res, 404, 'Not found');
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

server.listen(PORT, () => console.log(`Marklike API server running on port ${PORT}`));
