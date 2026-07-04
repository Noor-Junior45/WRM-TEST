
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import analyzeHandler from './api/analyze.js';
import parseInvoiceHandler from './api/parse-invoice.js';
import storageHandler from './api/storage.js';
import parseQueryHandler from './api/parse-query.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' })); // Increased limit for large backups
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// API Routes
app.post('/api/crawler-login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'noorpos_system_2025') {
    res.redirect('/?access_mode=crawler_granted');
  } else {
    res.status(401).send('<h1>401 Unauthorized</h1><p>Invalid credentials.</p>');
  }
});

app.all('/api/analyze', analyzeHandler);
app.all('/api/parse-invoice', parseInvoiceHandler);
app.all('/api/storage', storageHandler);
app.all('/api/parse-query', parseQueryHandler);

// Serve static assets or mount Vite middleware depending on environment
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  // Serve Static Files (Production Build)
  app.use(express.static(join(__dirname, 'dist')));

  // Public Invoice Handling
  app.get('/invoice/:id.html', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });

  // SPA Fallback
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Noor POS Server running on port ${PORT}`);
});
