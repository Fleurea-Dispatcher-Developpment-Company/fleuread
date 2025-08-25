// Baptiste M. 2025
const express = require('express');
const path = require('path');
const cors = require("cors");
const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');
const urler = require('url');
const StaticMaps = require('staticmaps');
const fs = require('fs');
const QRCode = require('qrcode');
const {PDFDocument, rgb, StandardFonts} = require('pdf-lib');

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
  const offset = urler.parse(req.url, true).query.offset;
  console.log(offset);
  ws.offset = parseInt(offset || '0', 10);
  console.log("Offset dans l'objet : ",ws.offset);
  console.log(sesId);
  let idclient;
  if (checkSession(sesId)) {
  setWS(sesId, ws);
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

async function setWS (sesId, ws) {
  if (await checkRole(sesId, 'driver')) {
    WSDriver.push(ws);
    console.log(WSDriver);
    broadcast("time");
  } else {
    WSAdmin.push(ws);
    console.log(WSAdmin);
 
    broadcast("time");
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
      'User-Agent': 'FleureaDispatcher_Adresser/1.0 (fleureadispatcher@gmail.com)'
    }
  });
  const result = await response.json();
  console.log(response);
  console.log(result);
  const address = result.address;
  console.log(address);
  return await transformAdress(address);
  } catch (err) {
    return err;
  }
}

async function transformAdress (address) {
  console.log("We have an adress as input :", address);
  const infrastructure = address.amenity || address.shop || address.railway || address.harbour || address.building || address.farm || address.farmyard || 'nodata';
  const numrue = address.housenumber || address.house_number || 'nodata';
  const route = address.road || address.pedestrian || address.footway || address.cycleway || address.path || 'nodata';
  const hameau = address.hamlet || address.neighbourhood || address.suburb || address.village || 'nodata';
  const ville = address.city || address.town || address.village || address.hamlet || 'nodata';
  const code_postal = address.postcode || 'nodata';
  const departement = address.state_district ||address.county || address.state || 'nodata';
  let keep = `${infrastructure}, ${numrue}, ${route}, ${hameau}, ${ville} (${code_postal}), ${departement}`;
  console.log(keep);
  const tablekeep = keep.split(',');
 // console.log("tablekeep :", tablekeep);
  keep = tablekeep.filter(item => item.trim() !== 'nodata');
 // console.log("keep :", keep);
  keep = keep.map(item => item.trim()).join(', ');
  return keep;
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

async function getIdFromSession(id) {
  return sessions[id].id;
}

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

function checkSession (id) {
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
    if (ws.readyState === ws.OPEN) {
      try {
        console.log(JSON.stringify(message));
      ws.send(JSON.stringify(message));
      } catch(err){console.error(err);}
    }
  }
}

async function broadcastToAdmins(message) {
  for(const ws of WSAdmin) {
    if (ws.readyState === ws.OPEN) {
       try {
         console.log(JSON.stringify(message));
      ws.send(JSON.stringify(message));
      } catch(err){console.error(err);}
    }
  }
}

async function broadcastTime(now) {
  for(const ws of WSAdmin) {
    console.log("BROADTIME");
    console.log(ws);
    if (ws.readyState === ws.OPEN) {
      console.log("Broadcast :", ws.offset);
       try {
         const offsetHere = ws.offset;
         console.log("Offset Here : ",offsetHere);
      ws.send(JSON.stringify({'action':'time', 'value':formatHour(now,offsetHere)}));
      } catch(err){console.error(err);}
    }
  }
    for(const ws of WSDriver) {
    console.log("BROADTIME");
    console.log(ws);
    if (ws.readyState === ws.OPEN) {
      console.log("Broadcast :", ws.offset);
       try {
         const offsetHere = ws.offset;
         console.log("Offset Here : ",offsetHere);
      ws.send(JSON.stringify({'action':'time', 'value':formatHour(now,offsetHere)}));
      } catch(err){console.error(err);}
    }
  }
}

async function broadcast (message) {
  if (message !== "time") {
  broadcastToDrivers(message);
  broadcastToAdmins(message);
  } else {
    broadcastTime(new Date());
    console.log("TIME BROADCASTING");
  }
}

async function sendHour () {
  const now = new Date();
  if (await checkNextHour(now)) {
    console.log("Nouvelle heure...");
    broadcast("time");
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

function formatHour (time, offseter) {
  console.log("offseter", offseter);
  const offset = offseter || 0;
  console.log("Entrée :", time, "+",offset);
  console.log(offset);
  const now = new Date(time.getTime() + offset * 60 * 60 *1000);
  console.log(now);
  let hour = now.getHours();
  //if (offset > 0) {
  //  hour = hour + offset;
  // }
  hour = hour.toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  let toret = `${hour}h${minute}`;
  console.log("Sortie :", toret);
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

app.post('/getgeneraldatas', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    if (await checkSession(thisid)) {
      const jsonme = await allDatas(thisid);
    res.send(jsonme);
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function getNameAndIcon (thisid) {
  let toret;
  const accounts = await readDatabase('comptes', '*');
  for (const compte of accounts) {
    if (compte.num === sessions[thisid].id) {
      toret = {icon:compte.link, name:compte.name, first_name:compte.first_name, role:translate(compte.auth)};
    }
  }
  return JSON.stringify(toret);
}

function translate(input) {
  const translateArray = {
    "driver":"Conducteur",
    "admin":"Administrateur"
  }
  return translateArray[input];
}

app.post('/getbennes', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    if (await checkRole('admin',thisid)) {
      const jsonme = await getBennes(thisid);
    res.json(jsonme);
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function getBennes(thisid) {
  let bennes = await readDatabase('bennes', '*');
  bennes.sort((a, b) => a.num - b.num);
  totalStatBen = bennes.length;
  nowStatBen = 0;
  const formatted = await Promise.all(
    bennes.map(async (benne) => {
      console.log("Lancement de la requête n°", nowStatBen);
    //  const adresse = await getAdress([benne.latitude,benne.longitude]);
      benneStatus(thisid);
      return {
        id:benne.num,
        volume:benne.volume,
        notes:benne.notes,
        latitude:benne.latitude,
        longitude:benne.longitude,
        altitude:benne.altitude,
        adresse:benne.adresse,
        cereale:benne.céréale,
        status:benne.statut,
        link:benne.link,
        ferme:await getFerme(benne.id_client),
        formatted_cereale:await getCereale(benne.céréale),
        auth:'Authenticated request !'
      }
    })
  );
  console.log(formatted);
  return formatted;
}

let totalStatBen;
let nowStatBen;

let totalStatCom;
let nowStatCom;

let totalStatCli;
let nowStatCli;

let totalStatCer;
let nowStatCer;

let totalStatPar;
let nowStatPar;

async function socketReload (what) {
  broadcastToAdmins({action:'reload', what:what});
}

async function benneStatus (thisid) {
  nowStatBen += 1;
  broadcastToAdmins({action:'benstatus', value:(nowStatBen/totalStatBen), who:thisid});
}

async function compteStatus (thisid) {
  nowStatCom += 1;
  broadcastToAdmins({action:'comstatus', value:(nowStatCom/totalStatCom), who:thisid});
}

async function clientStatus (thisid) {
  nowStatCli += 1;
  broadcastToAdmins({action:'clistatus', value:(nowStatCli/totalStatCli), who:thisid});
}

async function cerealeStatus (thisid) {
  nowStatCer += 1;
  broadcastToAdmins({action:'cerstatus', value:(nowStatCer/totalStatCer), who:thisid});
}

async function paramStatus (thisid) {
  nowStatPar += 1;
  broadcastToAdmins({action:'parstatus', value:(nowStatPar/totalStatPar), who:thisid});
}

app.post('/deletebenne', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const value_eq = req.body.num;
    if (await checkRole('admin',thisid)) {
      deleteDatabase ('bennes', 'num', value_eq);
      res.send("Suppression enregistrée avec succès !");
      socketReload ("benne");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/createbenne', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const num = req.body.num;
    const vol = req.body.volume;
    if (await checkRole('admin',thisid)) {
      addDatabase ('bennes', '', {num:num, volume:vol, creation:new Date(), longitude:"45.71834595682258", latitude:"4.230362827178187", statut:"C"}); // 45.71834595682258, 4.230362827178187
      res.send("Création enregistrée avec succès !");
      socketReload ("benne");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/editbenne', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const toupd = req.body.toupd;
    const value_toupd = req.body.value_toupd;
    const eq = req.body.eq;
    const value_eq = req.body.value_eq;
    if (await checkRole('admin',thisid)) {
      editDatabase ('bennes', toupd, value_toupd, eq, value_eq);
      res.send("Édition enregistrée avec succès !");
      const {latitude, longitude} = await getAdresseBenneEdit(value_eq);
      console.log("Entrée adresse benne", latitude, "*", longitude);
      const adresse = await getAdress([longitude, latitude]);
      editDatabase ('bennes', 'adresse', adresse, 'num', value_eq);
      socketReload ("benne");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function allDatas () {
  const table = {};
  table.cereales = await readDatabase('cereales', '*');
  table.clients = await readDatabase('clients', '*');
  table.bennes = await readDatabase('bennes', '*');
  return table;
}

app.post('/getcomptes', async (req, res) => {
  console.log("Réception d'un GET compte");
  try {
    const thisid = req.headers.auth;
    if (await checkRole('admin',thisid)) {
      const jsonme = await getComptes(thisid);
    res.json(jsonme);
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function getComptes(thisid) {
  let comptes = await readDatabase('comptes', '*');
  comptes.sort((a, b) => a.name - b.name);
  totalStatCom = comptes.length;
  nowStatCom = 0;
  const formatted = await Promise.all(
    comptes.map(async (compte) => {
      console.log("Lancement de la requête n°", nowStatCom);
      compteStatus(thisid);
      return {
        id:compte.num,
        name:compte.name,
        first_name:compte.first_name,
        last_connection:compte.lastconnect,
        auth:compte.auth,
        link:compte.link,
        password:compte.password
      }
    })
  );
  console.log(formatted);
  return formatted;
}

app.post('/deletecompte', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const value_eq = req.body.num;
    if (await checkRole('admin',thisid)) {
      deleteDatabase ('comptes', 'num', value_eq);
      res.send("Suppression enregistrée avec succès !");
      socketReload ("compte");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/createcompte', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const first_name = req.body.first_name;
    const name = req.body.name;
    const gen_num = Math.floor(100000 + Math.random() * 900000);
    const gen_password = crypto.randomBytes(3).toString('hex');
    const gen_date = new Date();
    if (await checkRole('admin',thisid)) {
      await addDatabase ('comptes', '', {num:gen_num, password:gen_password,creation:gen_date, first_name:first_name, name:name}); // 45.72191877191547, 4.227417998761897
      res.send("Création enregistrée avec succès !");
      socketReload ("compte");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/editcompte', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const toupd = req.body.toupd;
    const value_toupd = req.body.value_toupd;
    const eq = req.body.eq;
    const value_eq = req.body.value_eq;
    if (await checkRole('admin',thisid)) {
      editDatabase ('comptes', toupd, value_toupd, eq, value_eq);
      res.send("Édition enregistrée avec succès !");
      socketReload ("compte");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/getclients', async (req, res) => {
  console.log("Réception d'un GET client");
  try {
    const thisid = req.headers.auth;
    if (await checkRole('admin',thisid)) {
      const jsonme = await getClients(thisid);
    res.json(jsonme);
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function getClients(thisid) {
  let comptes = await readDatabase('clients', '*');
  comptes.sort((a, b) => a.name - b.name);
  totalStatCli = comptes.length;
  nowStatCli = 0;
  const formatted = await Promise.all(
    comptes.map(async (compte) => {
      console.log("Lancement de la requête n°", nowStatCli);
      clientStatus(thisid);
      return {
        id:compte.num,
        phonenumber:compte.phonenumber,
        notes:compte.notes,
        creation:compte.creation,
        link:compte.link,
        adresse:compte.adresse,
        latitude:compte.latitude,
        longitude:compte.longitude,
        name:compte.name
      }
    })
  );
  console.log(formatted);
  return formatted;
}

app.post('/deleteclient', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const value_eq = req.body.num;
    if (await checkRole('admin',thisid)) {
      deleteDatabase ('clients', 'num', value_eq);
      res.send("Suppression enregistrée avec succès !");
      socketReload ("client");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/createclient', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const phonenumber = req.body.phonenumber;
    const name = req.body.name;
    const gen_num = Math.floor(100000 + Math.random() * 900000);
    const gen_date = new Date();
    if (await checkRole('admin',thisid)) {
      await addDatabase ('clients', '', {num:gen_num, creation:gen_date, name:name, phonenumber:phonenumber}); // 45.72191877191547, 4.227417998761897
      res.send("Création enregistrée avec succès !");
      socketReload ("client");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/editclient', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const toupd = req.body.toupd;
    const value_toupd = req.body.value_toupd;
    const eq = req.body.eq;
    const value_eq = req.body.value_eq;
    if (await checkRole('admin',thisid)) {
      editDatabase ('clients', toupd, value_toupd, eq, value_eq);
      res.send("Édition enregistrée avec succès !");
      const {latitude, longitude} = await getAdresseFermeEdit(value_eq);
      console.log("Entrée adresse client", latitude, "*", longitude);
      const adresse = await getAdress([longitude, latitude]);
      editDatabase ('clients', 'adresse', adresse, 'num', value_eq);
      socketReload ("client");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/getcereales', async (req, res) => {
  console.log("Réception d'un GET céréale");
  try {
    const thisid = req.headers.auth;
    if (await checkRole('admin',thisid)) {
      const jsonme = await getCereales(thisid);
    res.json(jsonme);
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function getCereales(thisid) {
  let comptes = await readDatabase('cereales', '*');
  comptes.sort((a, b) => a.name - b.name);
  totalStatCer = comptes.length;
  nowStatCer = 0;
  const formatted = await Promise.all(
    comptes.map(async (compte) => {
      console.log("Lancement de la requête n°", nowStatCer);
      cerealeStatus(thisid);
      return {
        id:compte.num,
       code:compte.code,
        name:compte.name,
        photo:compte.photo
      }
    })
  );
  console.log(formatted);
  return formatted;
}

app.post('/deletecereale', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const value_eq = req.body.num;
    if (await checkRole('admin',thisid)) {
      deleteDatabase ('cereales', 'num', value_eq);
      res.send("Suppression enregistrée avec succès !");
      socketReload ("cereale");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/createcereale', async (req, res) => {
  try {
    const thisid = req.headers.auth;
  //  const phonenumber = req.body.phonenumber;
    const name = req.body.name;
    const gen_num = Math.floor(100000 + Math.random() * 900000);
    const gen_date = new Date();
    if (await checkRole('admin',thisid)) {
      await addDatabase ('cereales', '', {num:gen_num, name:name}); // 45.72191877191547, 4.227417998761897
      res.send("Création enregistrée avec succès !");
      socketReload ("cereale");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/editcereale', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const toupd = req.body.toupd;
    const value_toupd = req.body.value_toupd;
    const eq = req.body.eq;
    const value_eq = req.body.value_eq;
    if (await checkRole('admin',thisid)) {
      editDatabase ('cereales', toupd, value_toupd, eq, value_eq);
      res.send("Édition enregistrée avec succès !");
      socketReload ("cereale");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/getparams', async (req, res) => {
  console.log("Réception d'un GET params");
  try {
    const thisid = req.headers.auth;
    if (await checkRole('admin',thisid)) {
      const jsonme = await getParams(thisid);
    res.json(jsonme);
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function getParams(thisid) {
  let comptes = await readDatabase('informations', '*');
  comptes.sort((a, b) => a.name - b.name);
  totalStatPar = comptes.length;
  nowStatPar = 0;
  const formatted = await Promise.all(
    comptes.map(async (compte) => {
      console.log("Lancement de la requête n°", nowStatPar);
      paramStatus(thisid);
      return {
        id:compte.num,
        donnee:compte.donnee,
        value:compte.value,
        photo:compte.photo
      }
    })
  );
  console.log(formatted);
  return formatted;
}

app.post('/editparam', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const toupd = req.body.toupd;
    const value_toupd = req.body.value_toupd;
    const eq = req.body.eq;
    const value_eq = req.body.value_eq;
    if (await checkRole('admin',thisid)) {
      editDatabase ('informations', toupd, value_toupd, eq, value_eq);
      res.send("Édition enregistrée avec succès !");
      socketReload ("param");
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function setHistorique (who, what, content, table) {
  // Il faut récupérer la cellule selectionnée dans public:table:what
  const from = await readDatabase(table, '*');
  let cellule;
  for (const cell of from) {
    if (cell.num == what) {
      cellule = cell;
    }
  }
  // La convertir en tableau
  // Ajouter la ligne who made content on the table what
  cellule.push({who:who, content:content, what:what});
  // Remplacer le contenu de la cellule public:table:what par la valeur du tableau
}

// generate?what=QR&id=42
app.get('/generate', async (req, res) => {
  console.log("Generate QR-Code");
  const what = req.query.what;
  const id = req.query.id;
  try {
  const fileName = `QrCode_benne_${id}.pdf`;
  const filePath = path.join(__dirname, fileName);
  await pdfWithQr(id, filePath);
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  res.sendFile(filePath, err => {
    if (err) {
      res.status(500).send("Erreur serveur : " + err.message);
    } else {
      fs.unlinkSync(filePath);
    }
  });
  } catch (err) {
    console.error(err);
  }
});

async function pdfWithQr(id, filePath) {
  const url = `https://fleuread.onrender.com/driver?action=register&benne=${id}`;
  const qrDataUrl = await QRCode.toDataURL(String(url), {
    margin:1,
    width:150,
    color:{
      dark:'#000000',
      light:'#FFFFFF'
    }
  });
  const base64Data = qrDataUrl.split(',')[1];
  console.log("QR CODE GÉNÉRÉ !");
  // PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400,600]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fontSizeHeader = 18;
  const headerText = `Benne n°${id}`;
  const textWidth = font.widthOfTextAtSize(headerText, fontSizeHeader);
  const xCenter = (page.getWidth() - textWidth) / 2;
  
  page.drawText(headerText,{
    x:xCenter, y:550, size:fontSizeHeader, font, color:rgb(0,0,0)
  });

  page.drawRectangle({x:95, y:295, width:210, height:210, borderColor:rgb(0.8,0,0), borderWidth:4});
  page.drawRectangle({x:100, y:300, width:200, height:200, borderColor:rgb(1,0,0), borderWidth:2});
const qrImage = await pdfDoc.embedPng(base64Data);
  const qrDims = qrImage.scale(1);
  page.drawImage(qrImage, {x:100 + (200 - qrDims.width) / 2, y : 300 + 40, width:qrDims.width, height:qrDims.height});
  const fontSizeNumber = 30;
const numberText = String(id);
const numberWidth = font.widthOfTextAtSize(numberText, fontSizeNumber);
page.drawText(numberText, {
  x: 100 + (200 - numberWidth) / 2,
  y: 310,
  size: fontSizeNumber,
  font,
  color: rgb(0.7, 0, 0), // rouge foncé
});
  const explications = `Lien : ${url}. Découpez le cadre rouge et collez-le à proximité de la plaque d'immatriculation de la benne n°${id}. Scannez ce QR-Code avec un compte conducteur pour signaler automatiquement la position de cette benne au système Fleuréa Dispatcher. Pensez à bien désactiver la localisation une fois l'enregistrement terminé afin d'économiser la batterie.`;
  const fontSizeB = 10;
  const maxWidthB = 320;

  const textWidthB = font.widthOfTextAtSize(explications, fontSizeB);
  const xCenterB = (400 - Math.min(textWidthB, maxWidthB)) / 2;
  
  page.drawText(explications, {x:xCenterB, y:250, size:fontSizeB, font, color:rgb(0,0,0), maxWidth:maxWidthB});
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);
  return filePath;
}

app.post('/registerbenne', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const benne = req.body.id;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const altitude = req.body.altitude;
    if (await checkSession(thisid)) {
      // On renvoit le contenu de la page OK
      const bennes = await readDatabase('bennes', '*');
      let found = false;
      for (const ben of bennes) {
        if (ben.num == benne) {
          found = true;
        }
      }
      if (found) {
      let lastdriver = await getIdFromSession(thisid);
      await editDatabase ('bennes', 'longitude', latitude, 'num', benne);
      await editDatabase ('bennes', 'latitude', longitude, 'num', benne);
      await editDatabase ('bennes', 'altitude', altitude, 'num', benne);
      await editDatabase ('bennes', 'depose', new Date(), 'num', benne);
      await editDatabase ('bennes', 'dernierconducteur', lastdriver, 'num', benne);
      await editDatabase ('bennes', 'adresse', await getAdress([latitude, longitude]), 'num', benne);
      socketReload ("benne");
        console.log(longitude);
        console.log(latitude);
        let adresse = await getAdresseBenne(benne);
        let message = `Confirmation : la benne n°<strong>${benne}</strong> a bien été enregistrée à l'adresse <strong>${adresse}</strong>.<br> Merci !`;
        res.json({'status':'400','icon':'https://cdn.pixabay.com/photo/2013/07/12/18/22/check-153363_1280.png', 'message':message});
      } else {
        // On renvoit le contenu de la page benne inconnue
        res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2013/07/12/12/40/abort-146072_1280.png', 'message':`La benne ${benne} est inconnue dans nos systèmes...`});
      }
    } else {
     // On renvoit le contenu de la page non autorisé
      res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2013/07/12/17/00/remove-151678_1280.png', 'message':'Accès non autorisé'});
    }
  } catch (err) {console.error(err);
            res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2012/04/13/00/22/red-31226_1280.png', 'message':`Erreur : ${err}`});     
                }
});

app.post('/checkreferrer', async (req, res) => {
  console.log("CheckReferrer");
  try {
    const thisid = req.headers.auth;
    const url = req.body.url;

    if (await checkSession(thisid)) {
      console.log(url);
      const tocheck = new URL(url);

      if (tocheck.hostname === "fleuread.onrender.com" && tocheck.pathname === "/driver") {
        console.log("TRUE");
        return res.json({ value: true });
      } else {
        console.log("FALSE");
        return res.json({ value: false });
      }

    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/findbenne', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const benne = req.body.id;
    const off = req.body.offset;
    if (await checkSession(thisid)) {
      // On renvoit le contenu de la page OK
      const bennes = await readDatabase('bennes', '*');
      let found = false;
      for (const ben of bennes) {
        if (ben.num == benne) {
          found = true;
        }
      }
      if (found) {
        let latitude;
        let longitude;
        let altitude;
        let notes;
        let ferme;
        let adresse;
        let cereale;
        let conducteur;
        let depose;
            for (const ben of bennes) {
                if (ben.num == benne) {
                  latitude = ben.longitude,
                  longitude = ben.latitude,
                  altitude = ben.altitude ?? "x",
                  notes = ben.notes,
                  ferme = ben.id_client,
                  adresse = ben.adresse,
                  cereale = ben.céréale,
                  conducteur = ben.dernierconducteur,
                  depose = ben.depose
                }
              }
        conducteur = await getConducteur(conducteur);
        let fermefull = await getFerme(ferme);
        let phonenumber = await getPhoneNumber(ferme);
        let ferme_notes = await getNotes(ferme);
        cereale = await getCereale(cereale);
        let message = `Informations concernant la benne n°<strong>${benne}</strong> : <br>
        <u>Ferme</u> : ${fermefull} (<strong>${phonenumber}</strong>)<br>
        <u>Adresse</u> : <i>${adresse}</i> <br>
        <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">Ouvrir sur Google Maps</a><br>
        <u>Céréale</u> : ${cereale}<br>
        <u>Indications benne</u> : ${notes}<br>
        <u>Indications livraison</u> : ${ferme_notes}<br>
        Posée par <strong>${conducteur}</strong>, ${await formatTime(new Date(depose),off)}.
        `;
        res.json({'status':'400','icon':'https://cdn.pixabay.com/photo/2013/07/12/18/22/check-153363_1280.png', 'message':message});
      } else {
        // On renvoit le contenu de la page benne inconnue
        res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2013/07/12/12/40/abort-146072_1280.png', 'message':`La benne ${benne} est inconnue dans nos systèmes...`});
      }
    } else {
     // On renvoit le contenu de la page non autorisé
      res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2013/07/12/17/00/remove-151678_1280.png', 'message':'Accès non autorisé'});
    }
  } catch (err) {console.error(err);
            res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2012/04/13/00/22/red-31226_1280.png', 'message':`Erreur : ${err}`});     
                }
});

async function getConducteur(conducteur) {
  try {
  const conducteurs = await readDatabase('comptes', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == conducteur) {
      return `${conduc.name} ${conduc.first_name}`;
    }
  }
  } catch (err) {
    return "X";
  }
}

async function getFerme(conducteur) {
  try {
  const conducteurs = await readDatabase('clients', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == conducteur) {
      return `${conduc.name}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getPhoneNumber(conducteur) {
  try {
  const conducteurs = await readDatabase('clients', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == conducteur) {
      return `${conduc.phonenumber}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getNotes(conducteur) {
  try {
  const conducteurs = await readDatabase('clients', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == conducteur) {
      return `${conduc.notes}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getCereale(id) {
  try {
  const conducteurs = await readDatabase('cereales', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      return `${conduc.name}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getAdresseBenne(id) {
  try {
  const conducteurs = await readDatabase('bennes', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      return `${conduc.adresse}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getAdresseBenneEdit(id) {
  try {
  const conducteurs = await readDatabase('bennes', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      console.error("BenneEdit", {latitude:conduc.latitude, longitude:conduc.longitude});
      return {latitude:parseFloat(conduc.latitude), longitude:parseFloat(conduc.longitude)};
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getAdresseFermeEdit(id) {
  try {
  const conducteurs = await readDatabase('clients', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      console.error("FermeEdit", {latitude:conduc.latitude, longitude:conduc.longitude});
      return {latitude:parseFloat(conduc.latitude), longitude:parseFloat(conduc.longitude)};
    }
  }
     } catch (err) {
    return "X";
  }
}



async function getAdresseFerme(id) {
  try {
  const conducteurs = await readDatabase('clients', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      return `${conduc.adresse}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

function formatTime (time, offseter) {
  console.log("FORMAT TIME");
  console.log("offseter", offseter);
  const offset = offseter || 0;
  console.log("Entrée :", time, "+",offset);
  console.log(offset);
  const now = new Date(time.getTime() + offset * 60 * 60 *1000);
  console.log(now);
  let hour = now.getHours();
  //if (offset > 0) {
  //  hour = hour + offset;
  // }
  hour = hour.toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const date = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  let toret = `${date}/${month}/${year} ${hour}h${minute}`;
  console.log("Sortie :", toret);
  console.log(toret);
  return toret;
}

app.post('/smartsearchmap', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const value = req.body.value;
    if (value == "") {
      res.json({});
      return;
    }
    console.log("SMART SEARCH MAP");
    if (await checkSession(thisid)) {
      const options = [];
      // Dans la fonction on va :
      // 1. Interroger Nominatim
      if (value.length > 3) {
      console.log("Interrogation de NOMINATIM");
      try {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&addressdetails=1&countrycodes=fr,be,lu,de,ch,it,mc,es,ad,gb`, {
    headers:{
      'User-Agent': 'FleureaDispatcher_Searcher/1.0 (fleureadispatcher@gmail.com)'
    }
  });
  const result = await response.json();
        for (const opt of result) {
          options.push({text:await transformAdress (opt.address), search:await transformAdress (opt.address), position:{lat:opt.lat, lon:opt.lon}});
        }
      } catch (err) {
        console.error(err);
       // res.send(err);
      }
      }
      console.log(options);
      console.log("Le système parcourt les bennes");
      // 2. Chercher dans les bennes (n° et id client)
      try {
      const bennes = await readDatabase('bennes', '*');
      for (const ben of bennes) {
        if (String(ben.num || "").includes(value)) {
          options.push({text:`Benne n°${ben.num}`, search:ben.num, position:{lat:ben.longitude, lon:ben.latitude}});
        } else if (String(await getAdresseFerme(ben.id_client) || "").includes(value)) {
          options.push({text:`Benne n°${ben.num}`, search:ben.num, position:{lat:ben.longitude, lon:ben.latitude}});
        } else if (String(ben.adresse || "").includes(value)) {
          options.push({text:`Benne n°${ben.num}`, search:ben.num, position:{lat:ben.longitude, lon:ben.latitude}});
        }
      }
      } catch (err) {
        console.error(err);
       // res.send(err);
      }
      console.log(options);
      console.log("Le système parcourt les clients");
      // 3. Chercher dans les clients
       try {
      const bennes = await readDatabase('clients', '*');
      for (const ben of bennes) {
        if (String(ben.name || "").includes(value)) {
          options.push({text:ben.name, search:ben.name, position:{lat:ben.longitude, lon:ben.latitude}});
        } else if (String(await getAdresseFerme(ben.num) || "").includes(value)) {
          options.push({text:ben.name, search:await getAdresseFerme(ben.num) || "", position:{lat:ben.longitude, lon:ben.latitude}});
        }
      }
      } catch (err) {
        console.error(err);
       // res.send(err);
      }
      // On envoie les résultat, maintenant qu'on a tout scanné...
      res.json(options.reverse());
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.post('/getbenneinformations', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const benne = req.body.id;
    const off = req.body.offset;
    if (await checkSession(thisid)) {
      // On renvoit le contenu de la page OK
      const bennes = await readDatabase('bennes', '*');
      let found = false;
      for (const ben of bennes) {
        if (ben.num == benne) {
          found = true;
        }
      }
      if (found) {
        let latitude;
        let longitude;
        let altitude;
        let notes;
        let ferme;
        let adresse;
        let cereale;
        let cere;
        let conducteur;
        let condu;
        let depose;
            for (const ben of bennes) {
                if (ben.num == benne) {
                  latitude = ben.longitude,
                  longitude = ben.latitude,
                  altitude = ben.altitude ?? "x",
                  notes = ben.notes,
                  ferme = ben.id_client,
                  adresse = ben.adresse,
                  cereale = ben.céréale,
                  cere = ben.céréale;
                  conducteur = ben.dernierconducteur,
                  condu = ben.dernierconducteur,
                  depose = ben.depose
                }
              }
        conducteur = await getConducteur(conducteur);
        let fermefull = await getFerme(ferme);
        let phonenumber = await getPhoneNumber(ferme);
        let ferme_notes = await getNotes(ferme);
        cereale = await getCereale(cereale);
        let message = {
          a : benne, 
          b : benne.statut,
          c : fermefull,
          d : phonenumber,
          e : adresse,
          eb : `https://www.google.com/maps?q=${latitude},${longitude}`,
          f : cereale,
          g : notes,
          h : ferme_notes,
          i : conducteur,
          j : await formatTime(new Date(depose),off),
          k : await getIcon_conducteur(condu),
          l : await getIcon_cereale(cere),
          m : await getIcon_ferme(ferme),
          n : await getIcon_benne(benne)
        };
        console.log("LOGI");
        console.log(message);
        res.json({'status':'400','icon':'https://cdn.pixabay.com/photo/2013/07/12/18/22/check-153363_1280.png', 'message':message});
      } else {
        // On renvoit le contenu de la page benne inconnue
        res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2013/07/12/12/40/abort-146072_1280.png', 'message':`La benne ${benne} est inconnue dans nos systèmes...`});
      }
    } else {
     // On renvoit le contenu de la page non autorisé
      res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2013/07/12/17/00/remove-151678_1280.png', 'message':'Accès non autorisé'});
    }
  } catch (err) {console.error(err);
            res.json({'status':'200','icon':'https://cdn.pixabay.com/photo/2012/04/13/00/22/red-31226_1280.png', 'message':`Erreur : ${err}`});     
                }
});

async function getIcon_conducteur(id) {
  try {
  const conducteurs = await readDatabase('comptes', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      return `${conduc.link}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getIcon_cereale(id) {
  try {
  const conducteurs = await readDatabase('cereales', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      return `${conduc.photo}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getIcon_ferme(id) {
  try {
  const conducteurs = await readDatabase('clients', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      return `${conduc.link}`;
    }
  }
     } catch (err) {
    return "X";
  }
}

async function getIcon_benne(id) {
  try {
  const conducteurs = await readDatabase('bennes', '*');
  for (const conduc of conducteurs) {
    if (conduc.num == id) {
      return `${conduc.link}`;
    }
  }
     } catch (err) {
    return "X";
  }
}
