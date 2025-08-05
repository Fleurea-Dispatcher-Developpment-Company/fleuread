// Baptiste M. 2025
const express = require('express');
const path = require('path');
const cors = require("cors");
const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');
const urler = require('url');

// On gère tous les app.something
const app = express();

const PORT = process.env.PORT || 3000;
const url = "fleuread.onrender.com";

const server = http.createServer(app);
const wss = new WebSocket.Server({server});

server.listen(PORT, () => {
  console.log(`Le serveur de Fleuread fonctionne à l'adresse ${url}:${PORT}`);
  console.log(__dirname);
});

const WSDriver = [];
const WSAdmin = [];

wss.on('connection', (ws, req) => {
 console.log("Entrée WEBSOCKET");
  const sesId = urler.parse(req.url, true).query.key;
  console.log(sesId);
  let idclient;
  if (checkSession(sesId)) {
  if (checkRole(sesId, 'driver')) {
    WSDriver.push(ws);
    console.log(WSDriver);
    try{
    ws.send(JSON.stringify({'action':'time', 'value':formatHour(new Date())}));
       } catch(err) {console.error(err);}
  } else {
    WSAdmin.push(ws);
    console.log(WSAdmin);
    try {
    ws.send(JSON.stringify({'action':'time', 'value':formatHour(new Date())}));
    } catch(err) {console.error(err);}
  }
  } else {
    return;
  }
  ws.on('message', (data) => {
    console.log("Socket:");
    console.log(data);
    let parsedData = JSON.parse(data.toString('utf8'));
  });
  ws.on('close', () => {
    const indexDriver = WSDriver.indexOf(ws);
    const indexAdmin = WSAdmin.indexOf(ws);
    if (indexDriver !== -1) {
      WSDriver.splice(indexDriver, 1);
    }
    if (indexAdmin !== -1) {
      WSAdmin.splice(indexAdmin, 1);
    }
    console.log(WSDriver);
    console.log(WSAdmin);
  });
});

app.use(cors());
app.use(express.json());

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
    if (data) {console.log(data);
              return data;}
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
    .update({[toupd]:value_toupd})
    .eq(eq, value_eq)
    .select();
    if (data) {console.log(data);
              return data;}
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
    .eq(eq, value_eq);
    if (error) {console.error(error)}
  } catch (err) {console.error(err);}
}

async function addDatabase (store, select, jsontoinsert) {
  try {
    let {data, error} = await supabase
    .from(store)
    .insert([jsontoinsert])
    .select();
    if (data) {console.log(data);
              return data;}
    if (error) {console.error(error)}
  } catch (err) {console.error(err);}
}

// Gestion des sessions
const sessions = []; // Format sessions.id = id
app.post('/checksession', async (req, res) => {
  try {
  const data = req.body;
  const id = data.id;
  if (sessions[id]) {
    res.json({value:true});
  } else {
    res.json({value:false});
  }
  } catch (err) {console.error(err);}
});

app.post('/login', async (req, res) => {
  try {
  const data = req.body;
  const password = data.password;
  const accounts = await readDatabase('comptes','*');
  console.log(accounts);
  for (const compte of accounts) {
    if (compte.password == password) {
      console.log(compte.first_name, "", compte.NOM, " est enregistré(e)");
      const token = crypto.randomBytes(32).toString('hex');
      await editDatabase('comptes', 'auto_token', token, 'password', password);
      res.json({off:token});
    }
  }
    res.send({status:'no', off:"Le mot de passe est incorrect"});
  } catch (err) {console.error(err);}
});

app.post('/getsessionid', async (req, res) => {
  try {
  const data = req.body;
  const token = data.token;
  const accounts = await readDatabase('comptes','*');
  console.log(accounts);
  for (const compte of accounts) {
    if (compte.auto_token == token) {
      console.log(compte.first_name, "", compte.NOM, " est enregistré(e)");
      const sessionId = crypto.randomBytes(32).toString('hex');
      sessions[sessionId] = {};
      sessions[sessionId].id = compte.num;
      await editDatabase('comptes', 'lastconnect', new Date(), 'num', compte.num);
      res.json({id:sessionId});
    }
  }
  } catch(err) {console.error(err);}
});

  app.post('/getrole', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    if (await checkSession(thisid)) {
    res.send({'role':await getRole(thisid)});
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function checkRole (role, id) {
  if (await checkSession(id)) {
    if (await getRole(id) == role) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

async function checkSession (id) {
  if (sessions[id]) {
    return true;
  } else {
    return false;
  }
}

    async function getRole (id) {
      const accounts = await readDatabase('comptes', '*');
      for (const compte of accounts) {
        const me = sessions[id].id;
        console.log(compte.num);
        console.log(sessions[id].id);
        if (compte.num == sessions[id].id) {
          console.log("=");
          return compte.auth;
        }
      }
    }

app.get('/driver', async (req, res) => {
  try {
  res.sendFile(path.join(__dirname, 'public', 'driver.html'));
  } catch (err) {
    console.error(err);
  }
});

app.get('/admin', async (req, res) => {
  try {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } catch (err) {
    console.error(err);
  }
});

async function broadcastToDrivers(message) {
  for(const ws of WSDriver) {
    if (ws.readState === ws.OPEN) {
      try {
        console.log(JSON.stringify(message));
      ws.send(JSON.stringify(message));
      } catch(err){console.error(err);}
    }
  }
}

async function broadcastToAdmins(message) {
  for(const ws of WSAdmin) {
    if (ws.readState === ws.OPEN) {
       try {
         console.log(JSON.stringify(message));
      ws.send(JSON.stringify(message));
      } catch(err){console.error(err);}
    }
  }
}

async function broadcast (message) {
  broadcastToDrivers(message);
  broadcastToAdmins(message);
}

async function sendHour () {
  const now = new Date();
  if (await checkNextHour(now)) {
    console.log("Nouvelle heure...");
    broadcast({'action':'time', 'value':formatHour(now)});
  }
}

let last_time;

async function checkNextHour (time) {
 if (formatHour(time) == last_time) {
   console.log('false');
   return false;
 } else {
   console.log('true');
   last_time = formatHour(time);
   return true;
 }
}

function formatHour (time) {
  const now = new Date(time);
  const hour = now.getHours();
  const minute = now.getMinutes();
  let toret = `${hour}h${minute}`;
  console.log(toret);
  return toret;
}

setInterval(sendHour, 1000);

app.post('/getme', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    if (await checkSession(thisid)) {
      const jsonme = await getNameAndIcon(thisid);
    res.send(jsonme);
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function getNameAndIcon (thisid) {
  let toret;
  const accounts = readDatabase('comptes', '*');
  for (const compte of accounts) {
    if (compte.num === sessions[thisid].id) {
      toret = {icon:compte.link, name:compte.NOM, first_name:compte.first_name};
    }
  }
  return JSON.stringify(toret);
}
