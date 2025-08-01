// Baptiste M. 2025
const express = require('express');
const path = require('path');

// On gère tous les app.something
const app = express();

const PORT = process.env.PORT || 3000;
const url = "fleuread.onrender.com";

app.listen(PORT, () => {
  console.log(`Le serveur de Fleuread fonctionne à l'adresse ${url}:${PORT}`);
  console.log(__dirname);
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

// Fonction qui permet de laisser le serveur allumé 24h/24h
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

// Fonction de récupération de données via OSM
app.get('/osm', async (req, res) => {
  try {
  const [lat, long] = req.query.coords.split(',');
  const coords = [lat, long];
  console.log(coords);
  res.send(await getAdress(coords));
  } catch (err) {
    res.send(err);
  }
});

// Obtenir l'adresse à partir des coordonnées GPS
async function getAdress(coords) {
  try {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords[0]}&lon=${coords[1]}&format=json`, {
    headers:{
      'User-Agent': 'FleureaDispatcher/1.0 (fleureadispatcher@gmail.com)'
    }
  });
  const result = await response.json();
  console.log(result);
  const address = result.address;
  console.log(address);
  const route = address.road || address.pedestrian || address.footway || address.cycleway || address.path || 'nodata';
  const hameau = address.hamlet || address.neighbourhood || address.suburb || address.village || 'nodata';
  const ville = address.city || address.town || address.village || address.hamlet || 'nodata';
  const code_postal = address.postcode || 'nodata';
  const departement = address.county || address.state || 'nodata';
  let keep = `${route}, ${hameau}, ${ville} (${code_postal}), ${departement}`;
  console.log(keep);
  const tablekeep = keep.split(',');
  keep = tablekeep.filter(item => item !== 'nodata');
  keep = keep.join(',');
  return keep;
  } catch (err) {
    return err;
  }
}

