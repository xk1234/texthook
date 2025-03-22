const express = require('express');
const app = express();
const port = process.env.PORT || 3000; // Use the assigned port on Render or fallback to 3000


// Middleware to parse plain text bodies
app.use(express.text());

// Array to store connected SSE clients
let clients = [];

// SSE endpoint: add each new client to the list
app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  // Add the new client to the clients array
  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);
  console.log(`Client ${clientId} connected`);

  // Remove the client when connection closes
  req.on('close', () => {
    console.log(`Client ${clientId} disconnected`);
    clients = clients.filter(client => client.id !== clientId);
  });
});

// POST endpoint to receive messages
app.post('/message', (req, res) => {
  let message = req.body;
  
  // Ensure message is a string (convert if it's an object)
  if (typeof message === 'object') {
    message = JSON.stringify(message);
  }
  
  // Create a timestamp and format the full message
  const timestamp = new Date().toLocaleTimeString();
  const fullMessage = `[${timestamp}] ${message}`;
  
  // Broadcast the message to all connected SSE clients
  clients.forEach(client => {
    client.res.write(`data: ${fullMessage}\n\n`);
  });
  
  res.sendStatus(200);
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));


// curl -X POST -H 'Content-Type: text/plain' -d "Hello" http://localhost:3000/message

