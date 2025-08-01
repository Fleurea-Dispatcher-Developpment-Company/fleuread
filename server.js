// Baptiste M. 2025
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const url = "fleuread.onrender.com";

app.listen(PORT, () => {
  console.log(`Le serveur de Fleuread fonctionne à l'adresse ${url}:${PORT}`);
});

app.get('/', (req, res) => {
  res.sendFile("index.html");
});

