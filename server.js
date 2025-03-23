const express = require('express');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = 'https://sbokypllnsacwkhcrynm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to parse plain text bodies
app.use(express.text());

function getTodayInt() {
    // Convert today's date (YYYY-MM-DD) to an integer YYYYMMDD
    return parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
  }


// Array to store connected SSE clients
let clients = [];

// SSE endpoint to stream messages to clients
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

// Helper function to get today's date as an integer (YYYYMMDD)
function getTodayInt() {
  return parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
}

app.post('/message', upload.single('screenshot'), async (req, res) => {
  console.log('Received POST:', req.body);
  // If req.body is an object (as with multipart form data), extract the 'message' field.
  let message = (typeof req.body === 'object' && req.body.message) ? req.body.message : req.body;
  
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
    // Record exists; update its characters count.
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
    // No record exists for today; insert a new one.
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

  // Create a timestamp and prepare the payload.
  const timestamp = new Date().toLocaleTimeString();
  const payload = {
    timestamp,                 // The current time as a string.
    message,                   // The raw message text (e.g. "Hello World").
    screenshot: screenshotBase64  // Base64 string or null.
  };

  // Broadcast the payload to all connected clients.
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  res.sendStatus(200);
});





// Optional: GET endpoint to retrieve stats
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

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
