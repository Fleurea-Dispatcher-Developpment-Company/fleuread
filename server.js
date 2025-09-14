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
const cloudinary = require("cloudinary").v2;
const multer = require('multer');
const { Readable } = require('stream');

cloudinary.config({
  cloud_name : process.env.CLOUDINARY_NAME,
  api_key : process.env.CLOUDINARY_KEY,
  api_secret : process.env.CLOUDINARY_SECRET,
  secure:true
});

// Le système stocke en flash storage
//const storage = multer.diskStorage({
//  destination: 'uploads/',
//  filename: (req, file, cb) => {
//    cb(null, Date.now() + '-' + file.originalname);
//  }
//});

// Création du middleware upload
const upload = multer({dest: 'uploads/'});

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

app.get('/icon', async (req, res) => {
  try {
  res.sendFile(path.join(__dirname, 'public', 'icon_changer.html'));
  } catch (err) {
    console.error(err);
  }
});

app.get('/historique', async (req, res) => {
  try {
  res.sendFile(path.join(__dirname, 'public', 'historique.html'));
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
    readDatabase('bennes', '*'); // Cette ligne permet de maintenir Supabase en éveil
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
  console.log("Login");
  const data = req.body;
  const password = data.password;
  const accounts = await readDatabase('comptes','*');
  console.log(accounts);
  for (const compte of accounts) {
    if (compte.password == password) {
      console.log(compte);
      console.log(compte.first_name, "", compte.NOM, " est enregistré(e)");
      const token = crypto.randomBytes(32).toString('hex');
      let token_container = compte.auto_token || [];
      token_container.push(token);
      await editDatabase('comptes', 'auto_token', token_container, 'password', password);
      res.json({off:token});
    }
  }
    res.send({status:'no', off:"Le mot de passe est incorrect"});
  } catch (err) {console.error(err);}
});

app.post('/logout', async (req, res) => {
  try {
  console.log("Logout");
  const data = req.body;
  const password = data.session_id;
  const permatoken = data.token;
  const accounts = await readDatabase('comptes','*');
  console.log(accounts);
    // sessions[sessionId].id = compte.num;
    let searched_num = sessions[password].id;
  for (const compte of accounts) {
    if (compte.num == searched_num) {
      console.log(compte);
      console.log(compte.first_name, "", compte.name, " est en cours de déconnexion");
      let token_container = compte.auto_token || [];
      token_container.slice(token_container.indexOf(permatoken), 1);
      await editDatabase('comptes', 'auto_token', token_container, 'password', password);
      res.json({'status':'ok'});
      broadcast ({action:'disconnect', who:permatoken});
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
    if (compte.auto_token.includes(token)) {
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
        flash_id:`B${benne.num}A${benne.num}`,
        status:benne.statut,
        search_status:await convertToSearch(benne.statut),
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
      await addDatabase ('bennes', '', {num:num, volume:vol, creation:new Date(), longitude:"45.71834595682258", latitude:"4.230362827178187", statut:"C"}); // 45.71834595682258, 4.230362827178187
      res.send("Création enregistrée avec succès !");
      await setHistorique (sessions[thisid].id, num, "3", "bennes", vol, "Volume"); // Affectation à l'historique de la benne
      await setHistorique (num, sessions[thisid].id, "3", "comptes", vol, "Volume"); // Affectation à l'historique de l'actionneur
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
      console.log("AVANT");
      await setHistorique (sessions[thisid].id, value_eq, "1", "bennes", value_toupd, toupd); // Affectation à l'historique de la benne
      await setHistorique (value_eq, sessions[thisid].id, "1", "comptes", value_toupd, toupd); // Affectation à l'historique de l'actionneur
        if (toupd == "id_client") {
         await setHistorique (sessions[thisid].id, value_toupd, "1", "clients", value_eq, toupd); // Affectation à l'historique de la benne
        }
      console.log("APRÈS");
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
      await setHistorique (sessions[thisid].id, gen_num, "3", "comptes", name, "Nom", true); // Affectation à l'historique de la benne
      await setHistorique (gen_num, sessions[thisid].id, "3", "comptes", name, "Nom"); // Affectation à l'historique de l'actionneur
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
      await editDatabase ('comptes', toupd, value_toupd, eq, value_eq);
      res.send("Édition enregistrée avec succès !");
      await setHistorique (sessions[thisid].id, value_eq, "1", "comptes", value_toupd, toupd, true); // Affectation à l'historique du compte
      await setHistorique (value_eq, sessions[thisid].id, "1", "comptes", value_toupd, toupd); // Affectation à l'historique de l'actionneur
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
      await setHistorique (sessions[thisid].id, gen_num, "3", "clients", name, "Ferme"); // Affectation à l'historique de la benne
      await setHistorique (gen_num, sessions[thisid].id, "3", "comptes", name, "Ferme"); // Affectation à l'historique de l'actionneur
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
      await editDatabase ('clients', 'adresse', adresse, 'num', value_eq);
      await setHistorique (sessions[thisid].id, value_eq, "1", "clients", value_toupd, toupd); // Affectation à l'historique de lu compte
      await setHistorique (value_eq, sessions[thisid].id, "1", "comptes", value_toupd, toupd); // Affectation à l'historique de l'actionneur
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
      await setHistorique (sessions[thisid].id, num, "3", "cereales", name, "Nom"); // Affectation à l'historique de la benne
      await setHistorique (num, sessions[thisid].id, "3", "comptes", name, "Nom"); // Affectation à l'historique de l'actionneur
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

async function setHistorique (who, what, content, table, value, type, bool) {
  try {
  // Il faut récupérer la cellule selectionnée dans public:table:what
  console.log("Gamma");
  console.log(who, what, content, table, value, type, bool);
  const from = await readDatabase(table, '*');
  let cellule;
  for (const cell of from) {
    if (cell.num == what) {
      cellule = cell.historique || [];
      console.log(cellule);
    }
  }
  // La convertir en tableau
  // Ajouter la ligne who made content on the table what
    const now = new Date();
    console.log({who:who, when:now, content:content, what:what, value:value, table:table, type:type});
  cellule.push({who:who, when:now, content:content, what:what, value:value, table:table, type:type, passive:bool});
  // Remplacer le contenu de la cellule public:table:what par la valeur du tableau
    console.log("Lancement de l'édition en cours...");
  await editDatabase (table, 'historique', cellule, 'num', what);
    console.log("Opération terminée avec succès !");
  } catch (err) {
    console.error(err);
  }
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
    let altitude = req.body.altitude;
    if (altitude == "Inconnue") {
      altitude = await getAltitude (latitude, longitude);
    }
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
        setHistorique ( await getIdFromSession(thisid), benne, "2", "bennes", [latitude, longitude], "Position GPS");
        setHistorique ( benne, await getIdFromSession(thisid), "2", "comptes", [latitude, longitude], "Position GPS");
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
    if (value.startsWith("Benne n°")) {
      res.json({});
      return;
    }
    console.log("SMART SEARCH MAP");
    if (await checkSession(thisid)) {
      const options = [];
      // Dans la fonction on va :
      // 1. Interroger Nominatim
      if (!(value).includes("FOCUS:")) {
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
        } else if ((value).includes("FOCUS:")) {
          // str.split(":")[1]
            if (value.split(":")[1] == String(ben.num || "")) {
              options.push({text:`Benne n°${ben.num}`, search:ben.num, position:{lat:ben.longitude, lon:ben.latitude}});
            }
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
        let statusA;
            for (const ben of bennes) {
                if (ben.num == benne) {
                  latitude = ben.longitude,
                  longitude = ben.latitude,
                  altitude = ben.altitude ?? "x",
                  notes = ben.notes,
                  ferme = ben.id_client,
                   statusA = ben.statut, 
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
          b : statusA,
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
          n : await getIcon_benne(benne),
          o:latitude,
          p:longitude,
          q:altitude
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

// SMART SEARCHS

app.post('/smartsearchfarm', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const value = req.body.value;
    if (value == "") {
      res.json({});
      return;
    }
    console.log("SMART SEARCH FARM");
    if (await checkSession(thisid)) {
      const options = [];
      // Dans la fonction on va :
     
      // III) Chercher dans les clients
       try {
      const bennes = await readDatabase('clients', '*');
      for (const ben of bennes) {
        if (String(ben.name.toLowerCase() || "").includes(value.toLowerCase())) {
          options.push({text:ben.name, search:ben.num});
        } else if (String(ben.num || "").includes(value)) {
          options.push({text:ben.name, search:ben.num});
        } else if (String(ben.adresse || "").includes(value)) {
          options.push({text:ben.name, search:ben.num});
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

app.post('/smartsearchcereale', async (req, res) => {
  try {
    const thisid = req.headers.auth;
    const value = req.body.value;
    const biobool = req.body.biobool;
    if (value == "") {
      res.json({});
      return;
    }
    console.log("SMART SEARCH CEREALE");
    if (await checkSession(thisid)) {
      const options = [];
      // Dans la fonction on va :
     
      // III) Chercher dans les clients
       try {
      const bennes = await readDatabase('cereales', '*');
      for (const ben of bennes) {
        if (biobool) {
        if (String(ben.name.toLowerCase() || "").includes(value.toLowerCase())) {
                if (ben.name.toLowerCase().includes("BIO".toLowerCase())) {
                options.push({text:ben.name, search:ben.num});
                }
        } else if (String(ben.code || "").includes(value)) {
                if (ben.name.toLowerCase().includes("BIO".toLowerCase())) {
                options.push({text:ben.name, search:ben.num});
                }
        }
        } else {
          if (String(ben.name.toLowerCase() || "").includes(value.toLowerCase())) {
          if (!ben.name.toLowerCase().includes("BIO".toLowerCase())) {
                options.push({text:ben.name, search:ben.num});
                }
        } else if (String(ben.code || "").includes(value)) {
          if (!ben.name.toLowerCase().includes("BIO".toLowerCase())) {
                options.push({text:ben.name, search:ben.num});
                }
        }
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

async function convertToSearch(tosearch) {
  if (tosearch == "A") {
    return "STAT$POS";
  } else if (tosearch == "B") {
    return "STAT$PRE";
  } else if (tosearch == "C") {
    return "STAT$END";
  } else {
    return "STAT$UNK";
  }
}

// Changer l'image
app.post('/getimagedata', async (req, res) => {
  console.log("Réception d'un GET Image Data");
  try {
    const thisid = req.headers.auth;
    const type = req.body.type;
    const id = req.body.id;
    if (await checkSession(thisid)) {
      // compte
          if (type == "comptes") {
            if (await checkRole ('admin',thisid)) {
              res.json(await imageData(type, id));
            } else {
              if (id == thisid) {
                res.json(await imageData(type, id));
              }
            }
          }
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

async function imageData (type, id) {
// 1. Obtenir l'id du conducteur
  const num = sessions[id].id;
// 2. Obtenir l'image
  return {id:num, icon:await getIcon_conducteur(num)};
}

app.post('/changeimagedata', async (req, res) => {
  console.log("Changement de l'image");
  try {
    const thisid = req.headers.auth;
    const type = req.body.type;
    const id = req.body.id;
    const urlAb = req.body.url
    const lasturl = req.body.lasturl;
    if (await checkSession(thisid)) {
      // compte
          if (type == "comptes") {
            if (await checkRole ('admin',thisid)) {
              res.json(await changeImage(id, type, urlAb, lasturl));
            } else {
              if (id == sessions[thisid].id) {
                res.json(await changeImage(id, type, urlAb, lasturl));
              }
            }
          }
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

 async function changeImage (id, type, url, lasturl) {
  const answer = editDatabase (type, 'link', url, 'num', id);
  deleteImageFromUrl(lasturl);
  return {message:"Confirmation du changement d'image.", color:'yellow'};
 }

app.post('/registerafile', upload.single('media'), async (req, res) => {
  console.log("Enregistrement d'une image");
  try {
    const thisid = req.headers.auth;
    if (await checkSession(thisid)) {
              const filePath = req.file.path;
               const result = await cloudinary.uploader.upload (filePath, {
                    folder:'users', 
                    resource_type:'image'
               });
              fs.unlinkSync(filePath);
     const cryptoid = crypto.randomBytes(64).toString('hex');
     await addDatabase ('storage', '', {fleuread_id:cryptoid,link:result.secure_url});
      res.json({url:`/media?id=${cryptoid}`});
    } else {
      res.status(401);
    }
  } catch (err) {console.error(err);}
});

app.get('/media', async (req, res) => {
  console.log("Media");
  try {
    const fleuread_id = req.query.id;
    console.log(fleuread_id);
    const docs = await readDatabase('storage', '*');
    let true_url;
    for (const doc of docs) {
      if (doc.fleuread_id == fleuread_id) {
        true_url = String(doc.link);
        console.log(true_url);
      }
    }
    const tempFilePath = path.join(__dirname, `temp_file_${fleuread_id}`);
const fileStream = fs.createWriteStream(tempFilePath);

// Télécharger le fichier avec fetch
const response = await fetch(true_url);
if (!response.ok) {
  return res.status(500).send("Erreur lors de la récupération du fichier !");
}

// Copier le flux dans le fichier temporaire
await new Promise((resolve, reject) => {
  const nodeStream = Readable.fromWeb(response.body);
  nodeStream.pipe(fileStream);
  // response.body.on("error", reject);
  fileStream.on("finish", resolve);
});

// Envoyer le fichier au client
res.setHeader("Content-Type", "image/png");
res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
res.sendFile(tempFilePath, (err) => {
  if (err) {
    res.status(500).send("Erreur lors de l'envoi du fichier !");
  }
  fs.unlink(tempFilePath, () => {}); // supprimer le fichier temporaire
});
  } catch (err) {
    console.error(err);
  }
});

app.post('/gethistorique', async (req, res) => {
  console.log("Get Historique");
  const id = req.body.id;
  const type = req.body.type;
  const query = req.body.query;
  console.log(id, type);
  try {
    const thisid = req.headers.auth;
    if (await checkRole('admin', thisid)) {
     // On récupère l'historique
      console.log("Reading :", `${type}s`);
      const datas = await readDatabase(`${type}s`,'*');
      for (const item of datas) {
        if (item.num == id) {
          if (query) {
          res.json(await filtrerEnDetail(await toFormattedHistoriq (item.historique), query));
          } else {
          res.json(await toFormattedHistoriq (item.historique));  
          }
        }
      }
    } else {
      res.status(401).send("Non autorisé");
    }
  } catch (err) {console.error(err);}
});

async function getAltitude (lat, lon) {
  const data = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`);
  const elevation = await data.json();
  return elevation.results[0].elevation;
}

//app.post('/getidname', async (req, res) => {
 // console.log("Get ID");
 // const id = req.body.id;
 // try {
 //   const thisid = req.headers.auth;
 //   if (await checkRole('admin', thisid)) {
//     res.json({ans:await getConducteur(id)});
//    } else {
//      res.status(401).send("Non autorisé");
//    }
//  } catch (err) {console.error(err);}
// });

async function toFormattedHistoriq (table) {
  const tableau = [];
  for (const item of table) {
    if (item.table == "bennes") {
    tableau.push({who:await getConducteur(item.who), what:item.what, when:item.when, content:item.content, value:await convertValue(item.value,item.type), type:await convertLabel(item.type), table:item.table});
    }
    if (item.table == "comptes") {
              if (item.passive) {
              // Forme passive → Le requester subit l'action
              tableau.push({who:await getConducteur(item.who), what:await getConducteur(item.what), when:item.when, content:item.content, value:await convertValue(item.value,item.type), type:await convertLabel(item.type), table:item.table});
              } else {
              tableau.push({who:await getConducteur(item.what), what:item.who, when:item.when, content:item.content, value:await convertValue(item.value,item.type), type:await convertLabel(item.type), table:item.table});  
              }
      }
    if (item.table == "clients") {
    tableau.push({who:await getConducteur(item.who), what:item.value, when:item.when, content:item.content, value:await convertValue(item.what, item.type), type:await convertLabel(item.type), table:"bennes"});
    }
    }

  return tableau;
}

async function convertValue (input, criteria) {
  if (criteria == "céréale") {
    return await getCereale(input);
  }
   if (criteria == "id_client") {
    return await getFerme(input);
  }
  if (criteria == "auth") {
    if (input == "driver") {
      return "Conducteur";
    }
    if (input == "admin") {
      return "Administrateur";
    }
  }
  if (criteria == "statut") {
        if (input == "A") {
      return "Posée";
    }
    if (input == "B") {
      return "Prête";
    }
    if (input == "C") {
      return "En dépôt";
    }
  }
  return input;
}

async function convertLabel (input) {
  if (input == "céréale") {
    return "Céréale";
  }
   if (input == "id_client") {
    return "Client";
  }
  if (input == "statut") {
    return "État";
  }
  if (input == "auth") {
    return "Rôle";
  }
  if (input == "notes") {
    return "Indications";
  }
  return input;
}

async function filtrerEnDetail (table, query) {
  console.log("Lancement d'un protocole de filtration en détail");
  const offset = query.offset;
  let fulltable = table;
  fulltable = await filtrerA (fulltable, removeOffsetFromString(query.a, offset));
  fulltable = await filtrerB (fulltable, removeOffsetFromString(query.b, offset));
  fulltable = await filtrerC (fulltable, query.c.toLowerCase());
  fulltable = await filtrerD (fulltable, query.d.toLowerCase());
  fulltable = await filtrerE (fulltable, query.e.toLowerCase());
  fulltable = await filtrerF (fulltable, query.f.toLowerCase());
  fulltable = await filtrerG (fulltable, query.g.toLowerCase());
  fulltable = await filtrerH (fulltable, query.h.toLowerCase());
  return fulltable;
}

async function filtrerA (table, criteria) {
  // Cette fonction filtre les occurences après une date
  if (criteria.length == 0) {
    // On renvoie la table en l'absence de critère de filtrage
    return table;
  } else {
    // On traite la table pour retirer les éléments qui ne correspondent pas au critère de filtrage
  let toret = [];
  console.log("FILTRER A");
  console.log(criteria);
    for (const item of table) {
        if (compareDates(item.when, criteria) == 1) { // Ici nous voulons que la date comparée soit après → donc D1 (comparée) après D2 (critère)
          toret.push(item);
        }
    }
    return toret;
  }
  // Fin de la fonction
}

async function filtrerB (table, criteria) {
  // Cette fonction filtre les occurences après une date
  if (criteria.length == 0) {
    // On renvoie la table en l'absence de critère de filtrage
    return table;
  } else {
    // On traite la table pour retirer les éléments qui ne correspondent pas au critère de filtrage
  let toret = [];
  console.log("FILTRER B");
  console.log(criteria);
    for (const item of table) {
        if (compareDates(item.when, criteria) == -1) { // Ici nous voulons que la date comparée soit avant → donc D1 (comparée) avant D2 (critère)
          toret.push(item);
        }
    }
    return toret;
  }
  // Fin de la fonction
}

function compareDates(date1, date2) {
// Par convention nous dirons que la date 1 correpond à la date à comparer et date 2 au critère
  // Convertit en objets Date si ce sont des strings (ex: "2025-09-12T14:30")
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  if (d1.getTime() < d2.getTime()) {
    return -1; // date1 est AVANT date2
  } else if (d1.getTime() > d2.getTime()) {
    return 1;  // date1 est APRÈS date2
  } else {
    return 0;  // dates ÉGALES
  }
}

function removeOffsetFromString(dateStr, offset) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  date.setHours(date.getHours() - offset);
  return date.toISOString();
}

async function filtrerC (table, criteria) {
  // Cette fonction filtre les occurences après une date
  if (!criteria) {
    // On renvoie la table en l'absence de critère de filtrage
    return table;
  } else {
    // On traite la table pour retirer les éléments qui ne correspondent pas au critère de filtrage
  let toret = [];
  console.log("FILTRER ALL");
  console.log(criteria);
    for (const item of table) {
        if (String(item.who || "").toLowerCase().includes(criteria)) { // Ici nous voulons que la date comparée soit avant → donc D1 (comparée) avant D2 (critère)
          toret.push(item);
        }
    }
    return toret;
  }
  // Fin de la fonction
}

async function filtrerD (table, criteria) {
  // Cette fonction filtre les occurences après une date
  if (!criteria) {
    // On renvoie la table en l'absence de critère de filtrage
    return table;
  } else {
    // On traite la table pour retirer les éléments qui ne correspondent pas au critère de filtrage
  let toret = [];
  console.log("FILTRER ALL");
  console.log(criteria);
    for (const item of table) {
        if (String(item.content || "").toLowerCase().includes(criteria)) { // Ici nous voulons que la date comparée soit avant → donc D1 (comparée) avant D2 (critère)
          toret.push(item);
        }
    }
    return toret;
  }
  // Fin de la fonction
}

async function filtrerE (table, criteria) {
  // Cette fonction filtre les occurences après une date
  if (!criteria) {
    // On renvoie la table en l'absence de critère de filtrage
    return table;
  } else {
    // On traite la table pour retirer les éléments qui ne correspondent pas au critère de filtrage
  let toret = [];
  console.log("FILTRER ALL");
  console.log(criteria);
    for (const item of table) {
        if (String(item.what || "").toLowerCase().includes(criteria)) { // Ici nous voulons que la date comparée soit avant → donc D1 (comparée) avant D2 (critère)
          toret.push(item);
        }
    }
    return toret;
  }
  // Fin de la fonction
}

async function filtrerF (table, criteria) {
  // Cette fonction filtre les occurences après une date
  if (!criteria) {
    // On renvoie la table en l'absence de critère de filtrage
    return table;
  } else {
    // On traite la table pour retirer les éléments qui ne correspondent pas au critère de filtrage
  let toret = [];
  console.log("FILTRER ALL");
  console.log(criteria);
    for (const item of table) {
        if (String(item.table || "").toLowerCase().includes(criteria)) { // Ici nous voulons que la date comparée soit avant → donc D1 (comparée) avant D2 (critère)
          toret.push(item);
        }
    }
    return toret;
  }
  // Fin de la fonction
}

async function filtrerG (table, criteria) {
  // Cette fonction filtre les occurences après une date
  if (!criteria) {
    // On renvoie la table en l'absence de critère de filtrage
    return table;
  } else {
    // On traite la table pour retirer les éléments qui ne correspondent pas au critère de filtrage
  let toret = [];
  console.log("FILTRER ALL");
  console.log(criteria);
    for (const item of table) {
        if (String(item.type || "").toLowerCase().includes(criteria)) { // Ici nous voulons que la date comparée soit avant → donc D1 (comparée) avant D2 (critère)
          toret.push(item);
        }
    }
    return toret;
  }
  // Fin de la fonction
}

async function filtrerH (table, criteria) {
  // Cette fonction filtre les occurences après une date
  if (!criteria) {
    // On renvoie la table en l'absence de critère de filtrage
    return table;
  } else {
    // On traite la table pour retirer les éléments qui ne correspondent pas au critère de filtrage
  let toret = [];
  console.log("FILTRER ALL");
  console.log(criteria);
    for (const item of table) {
        if (String(item.value || "").toLowerCase().includes(criteria)) { // Ici nous voulons que la date comparée soit avant → donc D1 (comparée) avant D2 (critère)
          toret.push(item);
        }
    }
    return toret;
  }
  // Fin de la fonction
}

// Deleter d'images Cloudinary pour optimisation maximale du cloud...
async function deleteImageFromUrl(imageUrl) {
  console.log("DELETER !");
  try {
    // Exemple d'URL Cloudinary :
    // https://res.cloudinary.com/demo/image/upload/v1694567890/folder/myimage.jpg
    let fleuread_id = imageUrl;
    const urlove = new URL(fleuread_id);
    fleuread_id = urlove.searchParams.get("id");
    console.log(fleuread_id);
    const docs = await readDatabase('storage', '*'); // On lit notre stockage
    let true_url; 
    for (const doc of docs) {
      if (doc.fleuread_id == fleuread_id) {
        true_url = String(doc.link); // On obtient la vraie url
        console.log("TRUE URL:");
        console.log(true_url);
      }
    }
    console.log(true_url);
    const parts = true_url.split('/');
    console.log(parts);
    const publicIdWithExt = parts.slice(7).join('/'); // "folder/myimage.jpg"
    console.log(publicIdWithExt);
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // supprime l'extension
    console.log(publicId);

    const result = await cloudinary.uploader.destroy(publicId);
    console.log(result);
    deleteDatabase ('storage', imageUrl, 'fleuread_id');
    return result;
  } catch (err) {
    console.error('Erreur suppression:', err);
  }
}

// Génération document explicatif
app.get('/documentexplicatif', async (req, res) => {
  console.log("Generate QR-Code");
  const what = req.query.what;
  const id = req.query.id;
  try {
  const fileName = `QrCode_benne_${id}.pdf`;
  const filePath = path.join(__dirname, fileName);
  await pdf2(id, filePath);
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

async function pdf2(id, filePath) {
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

