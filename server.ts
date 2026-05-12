import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Endpoint to parse resume files (PDF, DOCX)
  app.post('/api/parse-resume', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { buffer, mimetype, originalname } = req.file;

    try {
      let text = '';
      if (mimetype === 'application/pdf') {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        text = result.text;
      } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        originalname.endsWith('.docx') ||
        originalname.endsWith('.doc')
      ) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF or DOCX file.' });
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Could not extract text from the file.' });
      }

      res.json({ text: text.trim() });
    } catch (error) {
      console.error('File parsing error:', error);
      res.status(500).json({ error: 'Failed to parse the file.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
