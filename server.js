// Baptiste M. 2025
const express = require('express');
const path = require('path');
const cors = require("cors");
const WebSocket = require('ws');

// On gère tous les app.something
const app = express();

const PORT = process.env.PORT || 3000;
const url = "fleuread.onrender.com";

app.listen(PORT, () => {
  console.log(`Le serveur de Fleuread fonctionne à l'adresse ${url}:${PORT}`);
  console.log(__dirname);
});

app.use(cors());

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
  const departement = address.state_district ||address.county || address.state || 'nodata';
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

// Configurations Supabase [background storage]
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Début des fonctions supabase
async function readDatabase (store, select) {
  try {
    let {data, error} = await supabase
    .from(store)
    .select(select);
    if (data) {console.log(data)}
    if (error) {console.error(error)}
  } catch (err) {console.error(err);}
}

async function editDatabase (store, toupd, value_toupd, eq, value_eq) {
  const update_value = `{${toupd}:'${value_toupd}'}`;
  const eq_value = `'${eq}', '${value_eq}'`;
  console.log(update_value, eq_value);
  try {
    let {data, error} = await supabase
    .from(store)
    .update(update_value)
    .eq(eq_value)
    .select();
    if (data) {console.log(data)}
    if (error) {console.error(error)}
  } catch (err) {console.error(err);}
}

async function deleteDatabase (store, eq, value_eq) {
  const eq_value = `'${eq}', '${value_eq}'`;
  console.log(eq_value);
  try {
    let {error} = await supabase
    .from(store)
    .delete()
    .eq(eq_value);
    if (error) {console.error(error)}
  } catch (err) {console.error(err);}
}

async function addDatabase (store, select, jsontoinsert) {
  try {
    let {data, error} = await supabase
    .from(store)
    .insert([jsontoinsert])
    .select();
    if (data) {console.log(data)}
    if (error) {console.error(error)}
  } catch (err) {console.error(err);}
}

// Gestion des sessions
const sessions = []; // Format sessions.id = id
app.post('/checksession', async (req, res) => {
  try {
  const data = req.body;
  let id;
  if (data.id) {
  id = data.id;
  } else {
  res.json({value:false});
  id = "system";
  }
  if (sessions[id]) {
    res.json({value:true});
  } else {
    res.json({value:false});
  }
  } catch (err) {console.error(err);}
});

