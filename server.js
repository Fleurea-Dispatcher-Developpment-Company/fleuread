// Baptiste M. 2025
const express = require('express');
const path = require('path');

// On gère tous les app.something
const app = express();

const PORT = process.env.PORT || 3000;
const url = "fleuread.onrender.com";

app.listen(PORT, () => {
  console.log(`Le serveur de Fleuread fonctionne à l'adresse ${url}:${PORT}`);
});

app.get('/', async (req, res) => {
  try {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (err) {
    console.error(err);
  }
});

app.get('/ping', async (req, res) => {
  try {
  res.json({'status':'on'});
  } catch (err) {
    console.error(err);
  }
});

async function autoPing () {
  try {
    const response = await fetch(`https://${url}/ping`);
    const data = await response.json();
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}

setInterval(autoPing, 1000*60*5);

