// server.js
import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file.
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// For ES modules, __dirname is not defined. We create one:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = 'https://sbokypllnsacwkhcrynm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Use environment variables for bucket and storage directory.
const BUCKET_NAME = process.env.BUCKET_NAME || 'bookmarks-screenshots';
const STORAGE_DIR = process.env.STORAGE_DIR || ''; // e.g., "mivy0t_1"

// Configure multer to use in-memory storage.
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to parse plain text bodies.
app.use(express.text());

// Helper function to get today's date as an integer (YYYYMMDD)
function getTodayInt() {
  return parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
}

// Array to store connected SSE clients.
let clients = [];

// SSE endpoint to stream messages to clients.
app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);
  console.log(`Client ${clientId} connected`);

  req.on('close', () => {
    console.log(`Client ${clientId} disconnected`);
    clients = clients.filter(client => client.id !== clientId);
  });
});

// /message endpoint: handles messages (and optional screenshot upload via multer)
app.post('/message', upload.single('screenshot'), async (req, res) => {
  console.log('Received POST:', req.body);
  
  // Extract the raw text from req.body.
  let message = '';
  if (typeof req.body === 'object') {
    message = req.body.clipboard || '';
  } else {
    message = req.body;
  }
  message = String(message);
  
  // Count characters in the message.
  const charCount = message.length;
  
  // Get today's integer (YYYYMMDD)
  const todayInt = getTodayInt();
  
  // Query for an existing record for today using the "day" column.
  const { data: existingStats, error: selectError } = await supabase
    .from('stats')
    .select('*')
    .eq('day', todayInt);
  
  if (selectError) {
    console.error('Error selecting stats:', selectError);
    return res.status(500).send('Error reading stats');
  }
  
  if (existingStats && existingStats.length > 0) {
    const existingRecord = existingStats[0];
    const newTotal = existingRecord.characters + charCount;
    const { error: updateError } = await supabase
      .from('stats')
      .update({ characters: newTotal })
      .eq('id', existingRecord.id);
  
    if (updateError) {
      console.error('Error updating stats:', updateError);
      return res.status(500).send('Error updating stats');
    }
    console.log(`Updated stats for day ${todayInt}: ${newTotal} characters`);
  } else {
    const { error: insertError } = await supabase
      .from('stats')
      .insert([{ day: todayInt, characters: charCount }]);
  
    if (insertError) {
      console.error('Error inserting stats:', insertError);
      return res.status(500).send('Error inserting stats');
    }
    console.log(`Inserted new stats for day ${todayInt}: ${charCount} characters`);
  }
  
  // If a screenshot is provided, convert it to a Base64 string.
  let screenshotBase64 = null;
  if (req.file) {
    screenshotBase64 = req.file.buffer.toString('base64');
  }
  
  const timestamp = new Date().toLocaleTimeString();
  const payload = {
    timestamp, // The current time as a string.
    message,   // The raw message text.
    screenshot: screenshotBase64 // Base64 string or null.
  };
  
  console.log("Broadcasting payload:", JSON.stringify(payload, null, 2));
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });
  
  res.sendStatus(200);
});

// /uploadFile endpoint: handles file uploads to Supabase Storage.
app.post('/uploadFile', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const fileData = req.file.buffer;
    const fileName = req.file.originalname;
    const storageFilePath = STORAGE_DIR ? `${STORAGE_DIR}/${fileName}` : fileName;
    
    console.log(`Uploading file ${fileName} to bucket "${BUCKET_NAME}" at path "${storageFilePath}"`);
    
    const { data, error } = await supabase
      .storage
      .from(BUCKET_NAME)
      .upload(storageFilePath, fileData, {
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ error: error.message });
    }
    
    // Return only the fullPath as plain text.
    res.json({ message: "Upload successful", data: data.fullPath });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Optional: GET endpoint to retrieve stats.
app.get('/stats', async (req, res) => {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .order('day', { ascending: false });
  
  if (error) {
    console.error('Error retrieving stats:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// Serve static files from the 'public' directory.
app.use(express.static('public'));

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
