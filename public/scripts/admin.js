const offset = -((new Date().getTimezoneOffset()) / 60);
      console.log(offset);
      
          async function start() {
      url = new URL(window.location.href);
      sessionId = await sessionStorage.getItem('session_id');
      if (!sessionId) {
        console.log("Not connected");
        window.location.href = `https://${url.hostname}`; 
      } else {
        if (await check(sessionId)) {
        console.log("Connected");
       await connectWebSocket();
          await getMe();
        } else {
        sessionStorage.removeItem('session_id');
        console.log("Not connected");
        window.location.href = `https://${url.hostname}`; 
        }
      }
            plotPoints();
      }
      
      start();

      
      async function check(id) {
        const answer = await fetcher('checksession',{'id':id},'POST','noauth');
        const bool = answer.value;
        console.warn(bool);
        if (bool) {
          console.warn("true");
          return true;
        } else {
          console.warn("false");
          return false;
        }
      }

      async function fetcher (endpoint, body, method, auth) {
        try {
        const response = await fetch(`https://${url.host}/${endpoint}`,{
          'method':method,
          'headers' : {
            'Content-Type':'application/json',
            'auth': auth
          }, 
          'body' : JSON.stringify(body)
        });
        const data = await response.json();
          return data;
        } catch (err) {return err;}
      }

      let socket;
      // Ici on gère la technologie websocket
      async function connectWebSocket() {
        if (socket && socket.readyState === WebSocket.OPEN) {
          return;
        }
        socket = new WebSocket (`wss://${url.host}?key=${sessionStorage.getItem('session_id')}&offset=${offset}`);
        socket.addEventListener('open', () => {
               // console.log("Connecté au serveur websocket !");
          socket.send(JSON.stringify({action:"SET", offset:offset}));
        });
        socket.addEventListener("message", (event) => {
        mes = JSON.parse(event.data);
        if (mes.action === 'time') {
          document.getElementById('time').textContent = mes.value;
        }
           if (mes.action === 'benstatus') {
          if (mes.who === sessionStorage.getItem('session_id')) {
            console.log(parseFloat(mes.value)*100);
            document.getElementById('benne_progress').value = parseFloat(mes.value)*100;
          }
             
      }
        if (mes.action === 'comstatus') {
          if (mes.who === sessionStorage.getItem('session_id')) {
            console.log(parseFloat(mes.value)*100);
            document.getElementById('compte_progress').value = parseFloat(mes.value)*100;
          }
        }
           if (mes.action === 'clistatus') {
          if (mes.who === sessionStorage.getItem('session_id')) {
            console.log(parseFloat(mes.value)*100);
            document.getElementById('client_progress').value = parseFloat(mes.value)*100;
          }
        }
            if (mes.action === 'cerstatus') {
          if (mes.who === sessionStorage.getItem('session_id')) {
            console.log(parseFloat(mes.value)*100);
            document.getElementById('cereale_progress').value = parseFloat(mes.value)*100;
          }
        }
            if (mes.action === 'parstatus') {
          if (mes.who === sessionStorage.getItem('session_id')) {
            console.log(parseFloat(mes.value)*100);
            document.getElementById('param_progress').value = parseFloat(mes.value)*100;
          }
        }
            if (mes.action === 'disconnect') {
              console.log("A/B");
              console.log(mes.who);
          if (mes.who === localStorage.getItem('offtoken')) {
            console.log("B/B");
          disconnect();
          }
        }

                            if (mes.action === 'reload') {
                        if (mes.what === "benne") {
                          reloadBenne();
                        }
                        if (mes.what === "client") {
                          reloadClient();
                        }
                               if (mes.what === "cereale") {
                          reloadCereale();
                        }
                               if (mes.what === "compte") {
                          start();
                                 reloadCompte();
                        }
                      }
        });
      }

let mydatas = {};
let generalDatas;
      
      async function getMe() {
        const answer = await fetcher('getme',{'id':sessionStorage.getItem('session_id')},'POST',sessionStorage.getItem('session_id'));
        const icon = answer.icon;
        const first_name = answer.first_name;
        const name = answer.name;
        const role = answer.role;
        document.getElementById('myPict').src = icon;
        document.getElementById('myName').textContent = `${first_name} ${name}`;
        mydatas["icon"] = icon;
        mydatas["first_name"] = first_name;
        mydatas["name"] = name;
        mydatas["role"] = role;
        const selections = answer.selections;
        const selecter_opt = document.getElementById('society_select');
        for (const item of selections) {
          const option = document.createElement("option");
          option.text = item.text;
          option.value = item.value;
          option.disabled = item.disabled;
          option.selected = item.selected;
          selecter_opt.append(option);
        }
       // getGeneralDatas();
      }

       async function getGeneralDatas() {
        const answer = await fetcher('getgeneraldatas',{'id':sessionStorage.getItem('session_id')},'POST',sessionStorage.getItem('session_id'));
        generalDatas = answer;
        console.log(generalDatas);
      }

// SCRIPT 2

const profilePic = document.getElementById('compte');
       const lightbox = document.getElementById('lightbox');
       const closeBtn = document.getElementById('close-btn');
       document.addEventListener('DOMContentLoaded', () => {
       profilePic.addEventListener('click', () => {
         lightbox.style.display = 'flex';
         document.getElementById('lightH2').textContent = mydatas["first_name"] + " " + mydatas["name"];
         document.getElementById('lightImg').src =  mydatas["icon"];
         document.getElementById('lightP').textContent =  mydatas["role"];
       });
        closeBtn.addEventListener('click', () => {
         lightbox.style.display = 'none';
       });
       lightbox.addEventListener('click', (e) => {
         if (e.target === lightbox) {
           lightbox.style.display = 'none';
         }
       });
       });

// SCRIPT 3
 const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' });
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' });
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap' , maxZoom: 17});
      // https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=2ad4ef15e8df44f784baefc78de0e6c7
    const transport = L.tileLayer('https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=2ad4ef15e8df44f784baefc78de0e6c7', { attribution: 'Map data: © OpenStreetMap contributors | Map style: © Thunderforest' });
    const landscape = L.tileLayer('https://tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=2ad4ef15e8df44f784baefc78de0e6c7', { attribution: 'Map data: © OpenStreetMap contributors | Map style: © Thunderforest' });
    
      const baseMaps = {
  "OpenStreetMap": osm,
  "Satellite": satellite,
      "Topographie":topo,
      "Transport":transport,
        "Landscape":landscape
  };
    
    const map = L.map('mapA').setView([45.72191877191547, 4.227417998761897], 15);
map.setMinZoom(4);
    L.control.layers(baseMaps, null, {position:'bottomleft'}).addTo(map);
    osm.addTo(map);
      setTimeout(() => {
      map.invalidateSize();
      }, 300);

 map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    // Afficher les coordonnées
  console.log(`Latitude: ${lat.toFixed(6)}, Longitude: ${lon.toFixed(6)}`);
   if (changerState) {
     showToast("Nouvelle position enregistrée.", "green");

     const content = {
                  altitude:"Inconnue",
                  latitude:lat,
                 longitude:lon,
                 id:nowPanel
              };
              console.log(content);
              fetcher('registerbenne', content, 'POST', sessionStorage.getItem('session_id'));
     changerState = false;
   }
  });
      
async function translateColor (input) {
  if (input == "A") {
    return "yellow";
  }
  if (input == "B") {
    return "red";
  }
  if (input == "C") {
    return "blue";
  }
}
      
    const markers = [];

// main.js

// Import Vincenty ellipsoidal (WGS84)
// import LatLon from 'https://cdn.jsdelivr.net/npm/geodesy@2.2.0/latlon-ellipsoidal-vincenty.js';

// Fonction utilitaire : calcule un point à distance donnée sur l'ellipsoïde
function destPoint(lat, lon, distanceMeters, bearingDeg) {
    const p = new LatLon(lat, lon);
    const d = p.destinationPoint(distanceMeters, bearingDeg);
    return { lat: d.lat, lon: d.lon };
}

// Crée un vrai cercle géodésique sous forme de polygone
function createGeodesicCircle(centerLat, centerLon, radiusMeters, steps = 64) {
    const coords = [];
    for (let i = 0; i < steps; i++) {
        const bearing = (360 / steps) * i;
        const p = destPoint(centerLat, centerLon, radiusMeters, bearing);
        coords.push([p.lat, p.lon]);
    }
    return coords;
}

// Fonction principale corrigée pour afficher les cercles
async function plotStorage() {
    const storagePoints = await fetcher('getstores', { authentified: true }, 'POST', sessionStorage.getItem('session_id'));
    console.log(storagePoints);

    for (const point of storagePoints) {
        const lat = parseFloat(point.latitude.trim());
        const lon = parseFloat(point.longitude.trim());
        const coords = createGeodesicCircle(lat, lon, point.radius);

        const circle = L.polygon(coords, {
            color: 'royalblue',
            fillColor: 'steelblue',
            fillOpacity: 0.4
        })
        .addTo(map)
        .bindPopup(point.name.toString());

        circle.off("click");

        circle.on("mouseover", function () { this.openPopup(); });
        circle.on("mouseout", function () { this.closePopup(); });
    }
}

// Lancer l'affichage
plotStorage();

      async function plotPoints () {
        // On possède les données
        // await getGeneralDatas();
        const pointBennes = await getBennes();
        // On enlève d'abord tous les marqueurs
           for (const marker of markers) {
             map.removeLayer(marker);
           }
        markers.length = 0;
        // 
        for (const benne of pointBennes) {
          console.log("Plotting de la benne n° ", benne.id);
          if (benne.longitude && benne.latitude) {
            console.log("Coordonnées : ", benne.longitude, ", ", benne.latitude);
            console.log(benne.status, " → ", await translateColor(benne.status));
          const marker = L.circleMarker([benne.longitude, benne.latitude], {
            radius:10,
            color:await translateColor(benne.status),
            fillColor:await translateColor(benne.status),
            fillOpacity:0.8
          })
          .addTo(map)
          .bindPopup(benne.id.toString())
          marker.on('click', function(e) {
            console.log(`La benne n° ${e.target.getPopup().getContent()} a été cliquée, nous allons afficher ses informations dans le panneau latéral`);
            pushPanel(e.target.getPopup().getContent());
          });
            markers.push(marker);
        }
        }
      }

      async function focusOn(text, position) {
             map.flyTo([position.lat, position.lon], 12, {
                  duration: 3,        
                  easeLinearity: 0.25 
                });
        const focus = L.marker([position.lat, position.lon]).addTo(map);
        focus.bindPopup(text).openPopup();
      };

      async function getBennes() {
        return await fetcher('getbennes',{'id':sessionStorage.getItem('session_id')},'POST',sessionStorage.getItem('session_id'));
      }

      async function putBennes(filtre) {
        document.getElementById("registerPop").onclick = () => logModification();
        await setForBennes ();
        console.log("Appel d'un putBennes...");
        const bennes = await getBennes();
        console.log(bennes);
        let filtered = [];
        if (filtre !== 'no') {
        filtered = await filter(bennes, filtre);
        } else {
        filtered = bennes;
        }
        console.log("Le système a filtré la liste :");
        console.log(filtered);
        const bennesContainer = document.getElementById('bennesContent');
        bennesContainer.innerHTML = "";
        console.log("On va traiter l'ajout...");
        for (const ben of filtered) {
          console.log("Création d'une benne :", ben);
          const line = document.createElement('div');
          line.classList.add('line');
          line.id = `B${ben.id}`;
benDatas[ben.id] = ben;
       const lightbox = document.getElementById('lightboxB');
       const closeBtn = document.getElementById('close-btnB');
        const imagePop = document.getElementById('lightImgB');
      console.log("LIGHTBOX");
      line.addEventListener('click', () => {
         lightbox.style.display = 'flex';
        console.log("Lien image :", ben.link);
        document.getElementById('imagePop').src = ben.link;
        // onclick="window.location.assign(`/icon?type=comptes&id=${sessionStorage.getItem('session_id')}`, '_blank');"
        document.getElementById('imagePop').onclick = () => {
          window.open(`/icon?type=bennes&id=${ben.id}`, '_blank');
        }
         document.getElementById('lightH2B').textContent = "Benne n°" + ben.id;
         document.getElementById('lightPB').textContent =  ben.volume + " T | " + ben.notes;
        const statusReadable = toread(ben.status);
        console.log(statusReadable);
        document.getElementById('lightPB3').innerHTML =  "<strong>" + statusReadable.charAt(0).toUpperCase() + statusReadable.slice(1) + "</strong> chez <strong>" + ben.ferme + "</strong> en <strong>" + ben.formatted_cereale + "</strong>";
         popAdresse(ben.adresse);
        numon = ben.id;
        console.log(numon);
        document.getElementById('editeurLightBenne').style.display == 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
        closeBtn.addEventListener('click', () => {
         lightbox.style.display = 'none';
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
       lightbox.addEventListener('click', (e) => {
         if (e.target === lightbox) {
           lightbox.style.display = 'none';
             document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
         }
       });
    
          
          const num = document.createElement('h1');
          num.textContent = ben.id;
          num.style.backgroundColor = tocolor(ben.status);
          line.append(num);
          const status = document.createElement('p');
          status.textContent = ben.ferme;
          // status.style.backgroundColor = tocolor(ben.status);
          line.append(status);

          const ab = document.createElement('p');
          ab.textContent = ben.society;
          line.append(ab);
          
          const pds = document.createElement('p');
          pds.textContent = ben.formatted_cereale;
          line.append(pds);
          
          const notes = document.createElement('p');
          notes.textContent = short(ben.notes);
          line.append(notes);

          const but2 = document.createElement('button');
          but2.textContent = `Carte`;
          but2.addEventListener('click', function (event) {
            event.stopPropagation();
            showMap(ben.id);
          });
        //  but2.onclick = () => {
           // showMap (ben.id);
           // }
          line.append(but2);
          
          const but = document.createElement('button');
          but.textContent = `QR-Code`;
          but.addEventListener('click', function (event) {
            event.stopPropagation();
            window.open(`https://fleuread.onrender.com/generate?what=QR&id=${ben.id}`,'_blank');
          });
          // but.onclick = () => {
           // window.open(`https://fleuread.onrender.com/generate?what=QR&id=${ben.id}`,'_blank');
           // }
          line.append(but);
          bennesContainer.append(line);
        }
      }

      async function filter (what, filtre) {
        console.log("Appel d'un filtre");
        console.log("Avant :", what);
        const query = filtre.toLowerCase();
        return what.filter(obj => Object.values(obj).some(val => String(val).toLowerCase().includes(query)));
      }

      function short(str) {
        if (str.length > 50) {
      return str.slice(0, 50) + "...";    
        } else {
      return str;
        }
      }

      function tocolor(statut) {
        if (statut == "A") {
          return 'yellow';
        }
         if (statut == "B") {
          return 'red';
        }
         if (statut == "C") {
          return 'blue';
        }
      }
      function toread(statut) {
        if (statut == "A") {
          return 'posée';
        }
         if (statut == "B") {
          return 'prête';
        }
         if (statut == "C") {
          return 'en dépôt';
        }
      }
      function toreadOpt(statut) {
        if (statut == "volume") {
          return 'Capacité (T)';
        }
         if (statut == "notes") {
          return 'Indications';
        }
         if (statut == "latitude") {
          return 'Longitude';
        }
           if (statut == "longitude") {
          return 'Latitude';
        }
           if (statut == "statut") {
          return 'État';
        }
         if (statut == "password") {
          return 'Mot de passe';
        }
         if (statut == "first_name") {
          return 'Prénom';
        }
        if (statut == "code") {
          return 'Code';
        }
        if (statut == "photo") {
          return "Image d'illustration";
        }
         if (statut == "name") {
          return 'Nom';
        }
        if (statut == "phonenumber") {
          return 'Informations de contact';
        }
         if (statut == "auth") {
          return 'Rôle dans la société';
        }
          if (statut == "admin") {
          return 'Administrateur';
        }
          if (statut == "driver") {
          return 'Conducteur';
        }
          if (statut == "value") {
          return 'Valeur';
        }
      }

 let numon;
      document.getElementById('createBenne').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = await Object.fromEntries(formData.entries());
        const content = {
          num:data.num,
          volume:data.volume
        };
        const fromServer = await fetcher('createbenne', content, 'POST', sessionStorage.getItem('session_id'));
        showToast(`Création de la benne n°${data.num} !`);
        putBennes('no');
        document.getElementById('createBenne').reset();
      });

      async function deleteBenne(num) {
        console.log(numon)
        if (confirm(`Supprimer la benne n°${numon} ?`)) {
          if(confirm("Confirmez pour la dernière fois... Cette action est irréversible")) {
        const content = {
          num:num
        };
        const fromServer = await fetcher('deletebenne', content, 'POST', sessionStorage.getItem('session_id'));
            showToast(`Suppression effective (Benne n°${numon}) !`);
        putBennes('no');
          }}
      }

const benDatas = {};
const comDatas = {};
const cliDatas = {};
const cerDatas = {};
const paramDatas = {};
let what;
      
      async function setForBennes () {
        what = "benne";
        selecterInput = [
        "volume",
        "notes",
        "latitude",
        "longitude",
        "statut"
        ];
        statusOpt = [
        {name:"Posée", value:"A", color:'yellow'},
        {name:"Prête",value:"B", color:'red'},
        {name:"En dépôt", value:"C", color:'blue'} // <button id="deleter" onclick="deleteBenne(numon)">Supprimer</button>
      ];
        setEditable();
        document.getElementById('deleter').onclick = () => {
          deleteBenne(numon)
        }
      }

        async function setForComptes () {
        what = "compte";
        selecterInput = [
        "password",
        "name",
        "first_name",
        "auth"
        ];
          statusOpt = [
        {name:"Conducteur", value:"driver", color:'green'},
        {name:"Administrateur",value:"admin", color:'blue'},
      ];
          setEditable();
          document.getElementById('deleter').onclick = () => {
          deleteCompte(numon)
        }
      }

      async function setForClients () {
        what = "client";
        selecterInput = [
        "phonenumber",
        "name",
        "latitude",
        "longitude",
        "notes"
        ];
          statusOpt = [
        {name:"Conducteur", value:"driver", color:'green'},
        {name:"Administrateur",value:"admin", color:'blue'},
      ];
          setEditable();
          document.getElementById('deleter').onclick = () => {
          deleteClient(numon)
        }
      }

            async function setForCereales () {
        what = "cereale";
        selecterInput = [
        "photo",
        "name",
        "code"
        ];
          statusOpt = [
        {name:"Conducteur", value:"driver", color:'green'},
        {name:"Administrateur",value:"admin", color:'blue'},
      ];
          setEditable();
          document.getElementById('deleter').onclick = () => {
          deleteCereale(numon)
        }
      }

         async function setForParams () {
        what = "param";
        selecterInput = [
        "value"
        ];
          statusOpt = [
        {name:"Conducteur", value:"driver", color:'green'},
        {name:"Administrateur",value:"admin", color:'blue'},
      ];
          setEditable();
          document.getElementById('deleter').onclick = () => {
          deleteParam(numon)
        }
      }
      
      
      const selecter = document.getElementById('modifierSelecter');
        let selecterInput = [
        "volume",
        "notes",
        "latitude",
        "longitude",
        "statut"
        ];

      let statusOpt = [
        {name:"Posée", value:"A", color:'yellow'},
        {name:"Prête",value:"B", color:'red'},
        {name:"En dépôt", value:"C", color:'blue'}
      ];
      async function setEditable() {
        selecter.innerHTML = "";
        const option = document.createElement('option');
          option.value = "no";
          option.text = "Sélectionnez un paramètre";
          option.disabled = true;
          selecter.append(option);
        for (const item of selecterInput) {
          const option = document.createElement('option');
          option.value = item;
          option.text = toreadOpt(item);
          selecter.append(option);
        }
      }
        selecter.addEventListener('change', (event) => {
          console.log(benDatas);
          const value = event.target.value;
          console.log("Change ", value);
          if (value == "statut") {
            console.log(true);
            document.getElementById('inpSelecter').style.display = "none";
            document.getElementById('suggester').style.display = "flex";
            document.getElementById('suggester').innerHTML="";
            for (const opt of statusOpt) {
              const button = document.createElement('button');
              button.textContent = opt.name;
              button.onclick = () => {
                selecter.selectedIndex = 5;
                document.getElementById('inpSelecter').value = opt.value;
                document.getElementById('registerPop').click();
              }
              button.style.color = "black";
              button.classList.add("button_status");
              button.style.backgroundColor = opt.color;
              document.getElementById('suggester').append(button);
            }
          } else if (value == "auth") {
            console.log(true);
            document.getElementById('inpSelecter').style.display = "none";
            document.getElementById('suggester').style.display = "flex";
            document.getElementById('suggester').innerHTML="";
            for (const opt of statusOpt) {
              const button = document.createElement('button');
              button.textContent = opt.name;
              button.onclick = () => {
                selecter.selectedIndex = 4;
                document.getElementById('inpSelecter').value = opt.value;
                document.getElementById('registerPop').click();
              }
              button.style.color = "black";
              button.classList.add("button_status");
              button.style.backgroundColor = opt.color;
              document.getElementById('suggester').append(button);
            }
          } else {
            document.getElementById('inpSelecter').style.display = "flex"
            document.getElementById('suggester').style.display = "none";
            document.getElementById('suggester').innerHTML = "";
          }
          if (what == "benne") {
          document.getElementById('inpSelecter').value = benDatas[numon][value];
          } else if (what == "compte") {
           document.getElementById('inpSelecter').value = comDatas[numon][value]; 
          } else if (what == "client") {
           document.getElementById('inpSelecter').value = cliDatas[numon][value]; 
          } else if (what == "cereale") {
           document.getElementById('inpSelecter').value = cerDatas[numon][value]; 
          } else if (what == "param") {
           document.getElementById('inpSelecter').value = paramDatas[numon][value]; 
          }
        });

// SCRIPT 4
 async function checkWebSocket() {
        if (!socket || socket.readyState == WebSocket.CLOSED ||  socket.readyState == WebSocket.CLOSING) {
          console.log("WebSocket Inactif !");
          window.location.reload();
        } else {
          console.log("WebSocket Actif !");
        }
      }
      setInterval(checkWebSocket, 15*1000);

      async function resizeMap () {
        document.getElementById('mapSearch').style.display = "flex";
        document.getElementById('panel').style.display = "flex";

        setTimeout(() => {
        document.getElementById('panel').style.display = "none";
        }, 10);
      }
      resizeMap();

      async function logModification () {
        const parameterToChange = selecter.value;
        const affSelecter = selecter.options[selecter.selectedIndex].text;
        console.log("affSelecter :", affSelecter);
        const value = document.getElementById('inpSelecter').value;
        const num = numon;
        const content = {
          toupd : parameterToChange,
          value_toupd : value,
          eq:'num',
          value_eq:num
        };
        console.log(content);
        const fromServer = await fetcher('editbenne', content, 'POST', sessionStorage.getItem('session_id'));
        setTimeout(() => {
        document.getElementById(`B${numon}`).click();
        }, 500);
        showToast(`Modification enregistrée (Benne n°${numon} - ${affSelecter}) !`);
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
        document.getElementById('inpSelecter').value = "";
        document.getElementById('filtrerBennes').click();
      }
      async function logModificationB () {
        const parameterToChange = selecter.value;
        const affSelecter = selecter.options[selecter.selectedIndex].text;
        console.log("affSelecter :", affSelecter);
        const value = document.getElementById('inpSelecter').value;
        const num = numon;
        const content = {
          toupd : parameterToChange,
          value_toupd : value,
          eq:'num',
          value_eq:num
        };
        console.log(content);
        const fromServer = await fetcher('editcompte', content, 'POST', sessionStorage.getItem('session_id'));
        setTimeout(() => {
        document.getElementById(`C${numon}`).click();
        }, 500);
        showToast(`Modification enregistrée (Compte n°${numon} - ${affSelecter}) !`);
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
        document.getElementById('inpSelecter').value = "";
        document.getElementById('filtrerComptes').click();
      }
      async function logModificationC () {
        const parameterToChange = selecter.value;
        const affSelecter = selecter.options[selecter.selectedIndex].text;
        console.log("affSelecter :", affSelecter);
        const value = document.getElementById('inpSelecter').value;
        const num = numon;
        const content = {
          toupd : parameterToChange,
          value_toupd : value,
          eq:'num',
          value_eq:num
        };
        console.log(content);
        const fromServer = await fetcher('editclient', content, 'POST', sessionStorage.getItem('session_id'));
        setTimeout(() => {
        document.getElementById(`D${numon}`).click();
        }, 500);
        showToast(`Modification enregistrée (Client n°${numon} - ${affSelecter}) !`);
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
        document.getElementById('inpSelecter').value = "";
        document.getElementById('filtrerClients').click();
      }
      async function logModificationD () {
        const parameterToChange = selecter.value;
        const affSelecter = selecter.options[selecter.selectedIndex].text;
        console.log("affSelecter :", affSelecter);
        const value = document.getElementById('inpSelecter').value;
        const num = numon;
        const content = {
          toupd : parameterToChange,
          value_toupd : value,
          eq:'num',
          value_eq:num
        };
        console.log(content);
        const fromServer = await fetcher('editcereale', content, 'POST', sessionStorage.getItem('session_id'));
        setTimeout(() => {
        document.getElementById(`E${numon}`).click();
        }, 500);
        showToast(`Modification enregistrée (Céréale n°${numon} - ${affSelecter}) !`);
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
        document.getElementById('inpSelecter').value = "";
        document.getElementById('filtrerCereales').click();
      }
      async function logModificationE () {
        const parameterToChange = selecter.value;
        const affSelecter = selecter.options[selecter.selectedIndex].text;
        console.log("affSelecter :", affSelecter);
        const value = document.getElementById('inpSelecter').value;
        const num = numon;
        const content = {
          toupd : parameterToChange,
          value_toupd : value,
          eq:'num',
          value_eq:num
        };
        console.log(content);
        const fromServer = await fetcher('editparam', content, 'POST', sessionStorage.getItem('session_id'));
        setTimeout(() => {
        document.getElementById(`F${numon}`).click();
        }, 500);
        showToast(`Modification enregistrée (Paramètre n°${numon} - ${affSelecter}) !`);
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
        document.getElementById('inpSelecter').value = "";
        document.getElementById('filtrerParams').click();
      }

// SCRIPT 5
function showToast(message, color = '#4CAF50') {
        const toast = document.createElement('div');
        toast.classList.add('toast');
        toast.textContent = message;
        toast.style.backgroundColor = color;
        document.getElementById('toast-container').append(toast);
        setTimeout(() => {
          toast.remove();
        }, 15000)
      }

      async function popAdresse (adresse) {
      //  document.getElementById('lightPB2').textContent = "Chargement de l'adresse...";
     //   const adresse = await fetch(`https://fleuread.onrender.com/osm?coords=${longitude},${latitude}`);
        document.getElementById('lightPB2').textContent = adresse;
      }
// SCRIPT 6
async function putComptes(filtre) {
              await setForComptes ();
              document.getElementById("registerPop").onclick = () => logModificationB();
        console.log("Appel d'un putComptes...");
        const bennes = await getComptes();
        console.log(bennes);
        let filtered = [];
        if (filtre !== 'no') {
        filtered = await filter(bennes, filtre);
        } else {
        filtered = bennes;
        }
        console.log("Le système a filtré la liste :");
        console.log(filtered);
        const bennesContainer = document.getElementById('comptesContent');
        bennesContainer.innerHTML = "";
        console.log("On va traiter l'ajout...");
        for (const ben of filtered) {
          console.log("Création d'une compte :", ben);
          const line = document.createElement('div');
          line.classList.add('line');
          line.id = `C${ben.id}`;
comDatas[ben.id] = ben;
       const lightbox = document.getElementById('lightboxB');
       const closeBtn = document.getElementById('close-btnB');
        const imagePop = document.getElementById('lightImgB');
      console.log("LIGHTBOX");
      line.addEventListener('click', () => {
         lightbox.style.display = 'flex';
        console.log("Lien image :", ben.link);
        document.getElementById('imagePop').src = ben.link;
        // document.getElementById('imagePop').onclick = () => {
        //  window.location.assign(`/icon?type=comptes&id=${ben.id}`, '_blank');
    //    }
         document.getElementById('lightH2B').innerHTML = ben.first_name + " " + ben.name + " <br> " + toreadOpt(ben.auth);
         document.getElementById('lightPB').textContent =  "Compte n°" + ben.id; // 
        document.getElementById('lightPB2').textContent =  "Euréa Coop";
        document.getElementById('lightPB3').innerHTML =  "Dernière connexion : <strong>" + formatTimestamp(ben.last_connection) + "</strong>" ;
  
        numon = ben.id;
        console.log(numon);
        document.getElementById('editeurLightBenne').style.display == 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
        closeBtn.addEventListener('click', () => {
         lightbox.style.display = 'none';
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
       lightbox.addEventListener('click', (e) => {
         if (e.target === lightbox) {
           lightbox.style.display = 'none';
             document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
         }
       });
    
          
         // const num = document.createElement('p');
         // num.textContent = ben.id;
        //  line.append(num);
          const status = document.createElement('p');
          status.innerHTML = ben.first_name + " " + ben.name + " <br> " + toreadOpt(ben.auth);
          line.append(status);
          const notes = document.createElement('p');
          notes.textContent = ben.password;
          line.append(notes);
          const button = document.createElement('button');
          button.textContent = "Historique";
          button.addEventListener('click', () => {
            window.open(`/historique?type=compte&id=${ben.id}`, '_blank');
          });
          line.append(button);
         //     if (ben.auth == "driver") {
             const buttonB = document.createElement('button');
          buttonB.textContent = "Document";
          buttonB.addEventListener('click', () => {
            window.open(`/documentexplicatif?session=${sessionStorage.getItem('session_id')}&id=${ben.id}`, '_blank');
          });
          line.append(buttonB);
       //       }
          const pds = document.createElement('p');
          pds.textContent = formatTimestamp(ben.last_connection);;
          line.append(pds);
          bennesContainer.append(line);
        }
      }
      async function getComptes() {
        return await fetcher('getcomptes',{'id':sessionStorage.getItem('session_id')},'POST',sessionStorage.getItem('session_id'));
      }

         document.getElementById('createCompte').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = await Object.fromEntries(formData.entries());
        const content = {
          name:data.name,
          first_name:data.first_name
        };
        const fromServer = await fetcher('createcompte', content, 'POST', sessionStorage.getItem('session_id'));
        showToast(`Création du compte de ${data.NOM} !`);
        putComptes('no');
        document.getElementById('createCompte').reset();
      });

      async function deleteCompte(num) {
        console.log(numon)
        if (confirm(`Supprimer le compte n°${numon} ?`)) {
          if(confirm("Confirmez pour la dernière fois... Cette action est irréversible")) {
        const content = {
          num:num
        };
        const fromServer = await fetcher('deletecompte', content, 'POST', sessionStorage.getItem('session_id'));
            showToast(`Suppression effective (Compte n°${numon}) !`);
        putComptes('no');
          }}
      }

        async function putClients(filtre) {
              await setForClients ();
              document.getElementById("registerPop").onclick = () => logModificationC();
        console.log("Appel d'un putClients...");
        const bennes = await getClients();
        console.log(bennes);
        let filtered = [];
        if (filtre !== 'no') {
        filtered = await filter(bennes, filtre);
        } else {
        filtered = bennes;
        }
        console.log("Le système a filtré la liste :");
        console.log(filtered);
        const bennesContainer = document.getElementById('clientsContent');
        bennesContainer.innerHTML = "";
        console.log("On va traiter l'ajout...");
        for (const ben of filtered) {
          console.log("Création d'un client :", ben);
          const line = document.createElement('div');
          line.classList.add('line');
          line.id = `D${ben.id}`;
cliDatas[ben.id] = ben;
       const lightbox = document.getElementById('lightboxB');
       const closeBtn = document.getElementById('close-btnB');
        const imagePop = document.getElementById('lightImgB');
      console.log("LIGHTBOX");
      line.addEventListener('click', () => {
         lightbox.style.display = 'flex';
        console.log("Lien image :", ben.link);
        document.getElementById('imagePop').src = ben.link;
        document.getElementById('imagePop').onclick = () => {
          window.open(`/icon?type=clients&id=${ben.id}`, '_blank');
        }
         document.getElementById('lightH2B').textContent =  ben.name;
         document.getElementById('lightPB').textContent = "Client n°" + ben.id; // 
        // document.getElementById('lightPB2').textContent =  "Euréa Coop";
        document.getElementById('lightPB3').innerHTML =  "Contact : <strong>" + ben.phonenumber + "</strong>" ;
        popAdresse(ben.adresse);
        numon = ben.id;
        console.log(numon);
        document.getElementById('editeurLightBenne').style.display == 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
        closeBtn.addEventListener('click', () => {
         lightbox.style.display = 'none';
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
       lightbox.addEventListener('click', (e) => {
         if (e.target === lightbox) {
           lightbox.style.display = 'none';
             document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
         }
       });
    
          
        const num = document.createElement('p');
        num.textContent = ben.id;
        line.append(num);
          const status = document.createElement('p');
          status.innerHTML = ben.name + " <br> " + ben.phonenumber;
          line.append(status);
          const notes = document.createElement('p');
          notes.textContent = ben.notes;
          line.append(notes);
          const button = document.createElement('button');
          button.textContent = "Historique";
          button.addEventListener('click', () => {
            window.open(`/historique?type=client&id=${ben.id}`, '_blank');
          });
          line.append(button);
          const pds = document.createElement('p');
          pds.textContent = ben.adresse;
          line.append(pds);
          bennesContainer.append(line);
        }
      }
      async function getClients() {
        return await fetcher('getclients',{'id':sessionStorage.getItem('session_id')},'POST',sessionStorage.getItem('session_id'));
      }

         document.getElementById('createClient').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = await Object.fromEntries(formData.entries());
        const content = {
          phonenumber:data.phonenumber,
          name:data.name
        };
        const fromServer = await fetcher('createclient', content, 'POST', sessionStorage.getItem('session_id'));
        showToast(`Création du client ${data.name} !`);
        putClients('no');
        document.getElementById('createClient').reset();
      });

      async function deleteClient(num) {
        console.log(numon)
        if (confirm(`Supprimer le client n°${numon} ?`)) {
          if(confirm("Confirmez pour la dernière fois... Cette action est irréversible")) {
        const content = {
          num:num
        };
        const fromServer = await fetcher('deleteclient', content, 'POST', sessionStorage.getItem('session_id'));
            showToast(`Suppression effective (Client n°${numon}) !`);
        putClients('no');
          }}
      }
      
      function formatTimestamp(timestamp) {
  const date = new Date(timestamp);

  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0'); // +1 car les mois commencent à 0
  const annee = String(date.getFullYear()).slice(-2); // Prend les 2 derniers chiffres

  const heures = String(date.getHours() + offset).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${jour}/${mois}/${annee} à ${heures}h${minutes}`;
}

      async function putCereales(filtre) {
              await setForCereales ();
              document.getElementById("registerPop").onclick = () => logModificationD();
        console.log("Appel d'un putCereales...");
        const bennes = await getCereales();
        console.log(bennes);
        let filtered = [];
        if (filtre !== 'no') {
        filtered = await filter(bennes, filtre);
        } else {
        filtered = bennes;
        }
        console.log("Le système a filtré la liste :");
        console.log(filtered);
        const bennesContainer = document.getElementById('cerealesContent');
        bennesContainer.innerHTML = "";
        console.log("On va traiter l'ajout...");
        for (const ben of filtered) {
          console.log("Création d'un client :", ben);
          const line = document.createElement('div');
          line.classList.add('line');
          line.id = `E${ben.id}`;
cerDatas[ben.id] = ben;
       const lightbox = document.getElementById('lightboxB');
       const closeBtn = document.getElementById('close-btnB');
        const imagePop = document.getElementById('lightImgB');
      console.log("LIGHTBOX");
      line.addEventListener('click', () => {
         lightbox.style.display = 'flex';
        console.log("Lien image :", ben.photo);
        document.getElementById('imagePop').src = ben.photo;
        document.getElementById('imagePop').onclick = () => {
          window.open(`/icon?type=cereales&id=${ben.id}`, '_blank');
        }
         document.getElementById('lightH2B').textContent =  ben.name;
         document.getElementById('lightPB').textContent = "Code : " + ben.code; // 
        document.getElementById('lightPB2').textContent =  "Euréa Coop";
        document.getElementById('lightPB3').innerHTML =  "Céréale" ;
        numon = ben.id;
        console.log(numon);
        document.getElementById('editeurLightBenne').style.display == 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
        closeBtn.addEventListener('click', () => {
         lightbox.style.display = 'none';
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
       lightbox.addEventListener('click', (e) => {
         if (e.target === lightbox) {
           lightbox.style.display = 'none';
             document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
         }
       });
    
          
        //  const num = document.createElement('p');
        //  num.textContent = ben.id;
         // line.append(num);
          const status = document.createElement('p');
          status.textContent = ben.name;
          line.append(status);
          const notes = document.createElement('p');
          notes.textContent = ben.code;
          line.append(notes);
         // const pds = document.createElement('p');
       // pds.textContent = ben.adresse;
        // line.append(pds);
          bennesContainer.append(line);
        }
      }
      async function getCereales() {
        return await fetcher('getcereales',{'id':sessionStorage.getItem('session_id')},'POST',sessionStorage.getItem('session_id'));
      }

         document.getElementById('createCereale').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = await Object.fromEntries(formData.entries());
        const content = {
          name:data.name
        };
        const fromServer = await fetcher('createcereale', content, 'POST', sessionStorage.getItem('session_id'));
        showToast(`Création de la céréale ${data.name} !`);
        putCereales('no');
        document.getElementById('createCereale').reset();
      });

      async function deleteCereale(num) {
        console.log(numon)
        if (confirm(`Supprimer la céréale n°${numon} ?`)) {
          if(confirm("Confirmez pour la dernière fois... Cette action est irréversible")) {
        const content = {
          num:num
        };
        const fromServer = await fetcher('deletecereale', content, 'POST', sessionStorage.getItem('session_id'));
            showToast(`Suppression effective (Céréale n°${numon}) !`);
        putCereales('no');
          }}
      }

       async function putParams(filtre) {
              await setForParams ();
              document.getElementById("registerPop").onclick = () => logModificationE();
        console.log("Appel d'un putParams...");
        const bennes = await getParams();
        console.log(bennes);
        let filtered = [];
        if (filtre !== 'no') {
        filtered = await filter(bennes, filtre);
        } else {
        filtered = bennes;
        }
        console.log("Le système a filtré la liste :");
        console.log(filtered);
        const bennesContainer = document.getElementById('infosContent');
        bennesContainer.innerHTML = "";
        console.log("On va traiter l'ajout...");
        for (const ben of filtered) {
          console.log("Création d'un paramètre :", ben);
          const line = document.createElement('div');
          line.classList.add('line');
          line.id = `F${ben.id}`;
paramDatas[ben.id] = ben;
       const lightbox = document.getElementById('lightboxB');
       const closeBtn = document.getElementById('close-btnB');
        const imagePop = document.getElementById('lightImgB');
      console.log("LIGHTBOX");
          if (ben.editable) {
      line.addEventListener('click', () => {
         lightbox.style.display = 'flex';
        console.log("Lien image :", ben.photo);
        document.getElementById('imagePop').src = ben.photo;
         document.getElementById('lightH2B').textContent =  ben.donnee;
         document.getElementById('lightPB').innerHTML = ben.value; // 
        if (!ben.deletable) {
        document.getElementById('lightPB2').textContent =  "Euréa Coop";
        } else {
        document.getElementById('lightPB2').innerHTML =  `<button onclick="removeStorage(${ben.id})">Supprimer</button>`;  
        }
        document.getElementById('lightPB3').innerHTML =  "Paramètre" ;
        numon = ben.id;
        console.log(numon);
        document.getElementById('editeurLightBenne').style.display == 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
          }
        closeBtn.addEventListener('click', () => {
         lightbox.style.display = 'none';
        document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
       });
       lightbox.addEventListener('click', (e) => {
         if (e.target === lightbox) {
           lightbox.style.display = 'none';
             document.getElementById('editeurLightBenne').style.display = 'none';
        selecter.selectedIndex = 0;
         document.getElementById('inpSelecter').value = "";
         }
       });
    
          
        //  const num = document.createElement('p');
         // num.textContent = ben.id;
        //  line.append(num);
          const status = document.createElement('p');
          status.textContent = ben.donnee;
          line.append(status);
          const notes = document.createElement('p');
          notes.innerHTML = ben.value;
          line.append(notes);
         // const pds = document.createElement('p');
         // pds.textContent = ben.adresse;
         // line.append(pds);
          bennesContainer.append(line);
        }
      }
      
      async function getParams() {
        return await fetcher('getparams',{'id':sessionStorage.getItem('session_id')},'POST',sessionStorage.getItem('session_id'));
      }
      // SCRIPT 7
const input =  document.getElementById('mapSearch_input');
      const resultContainer = document.getElementById('result_mapSearch');
      let thisvalue;
      let debounceTimer;
      
      input.addEventListener('input', async () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
        thisvalue = input.value;
        const answer = await fetcher('smartsearchmap',{value:thisvalue}, 'POST', sessionStorage.getItem('session_id'));
        resultContainer.innerHTML = "";
        if (answer.length > 1) {
        for (const item of answer) {
          const button = document.createElement('div');
          button.style.backgroundColor = "rgba(173, 216, 230, 0.5)";
          button.style.border = "1px solid black";
          button.style.width = "100 %";
          button.innerHTML = `${item.text}`;
          button.onclick = () => {
            input.value = item.text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            focusOn(item.text,item.position);
            setTimeout(() => {resultContainer.innerHTML = "";}, 2000);
          }
          resultContainer.append(button);
        }
        } else if (answer.length < 1) {
          const button = document.createElement('button');
          button.innerHTML = `Aucun élément ne correspond à votre recherche.`;
          resultContainer.append(button);
        } else {
          focusOn(answer[0].text,answer[0].position);
        }
        }, 500);
      });
// SCRIPT 8
 async function pushPanel(id) {
        onshow = true;
        nowPanel = id;
        const panel = document.getElementById('panelcontent');
        document.getElementById('panel').style.display = "flex";
        document.getElementById('mapSearch').style.display = "none";
        const content = {
          id:id,
            offset:offset
        };
        let fromServer = await fetcher ('getbenneinformations', content, 'POST', sessionStorage.getItem('session_id'));
        fromServer = fromServer.message;
        console.log(fromServer);
        document.getElementById('panel_A_img').src = fromServer.n;
        document.getElementById('panel_A_h1').textContent = fromServer.a;
        document.getElementById('panel_B_p').textContent = toread(fromServer.b);
        document.getElementById('panel_B').style.backgroundColor = tocolor(fromServer.b);
        document.getElementById('panel_C_p').textContent = fromServer.c;
        document.getElementById('panel_C_i').textContent = fromServer.d;
         document.getElementById('panel_V_p').textContent = fromServer.g;
        document.getElementById('panel_V_pb').textContent = fromServer.h;
        document.getElementById('panel_L_p').textContent = fromServer.r;
        selectOptionByText(fromServer.r);

document.getElementById('editer_a').textContent = toread("A");
document.getElementById('editer_a').style.backgroundColor = tocolor("A");
document.getElementById('editer_b').textContent = toread("B");
document.getElementById('editer_b').style.backgroundColor = tocolor("B");
document.getElementById('editer_c').textContent = toread("C");
document.getElementById('editer_c').style.backgroundColor = tocolor("C");

document.getElementById('editer_a').onclick = async () => {
        const content = {
          toupd : 'statut',
          value_toupd : 'A',
          eq:'num',
          value_eq:fromServer.a
        };
        console.log(content);
        const responseServer = await fetcher('editbenne', content, 'POST', sessionStorage.getItem('session_id'));
          pushPanel(fromServer.a);
}

        document.getElementById('editer_b').onclick = async () => {
        const content = {
          toupd : 'statut',
          value_toupd : 'B',
          eq:'num',
          value_eq:fromServer.a
        };
        console.log(content);
        const responseServer = await fetcher('editbenne', content, 'POST', sessionStorage.getItem('session_id'));
          pushPanel(fromServer.a);
}

        document.getElementById('editer_c').onclick = async () => {
        const content = {
          toupd : 'statut',
          value_toupd : 'C',
          eq:'num',
          value_eq:fromServer.a
        };
        console.log(content);
        const responseServer = await fetcher('editbenne', content, 'POST', sessionStorage.getItem('session_id'));
          pushPanel(fromServer.a);
}
        document.getElementById('panel_I_lat').textContent = fromServer.o;
        document.getElementById('panel_I_lon').textContent = fromServer.p;
        document.getElementById('panel_I_alt').textContent = `${Math.round(parseFloat(fromServer.q))} m`;
         document.getElementById('panel_D_i').textContent = fromServer.e;
        document.getElementById('panel_D_i').href = `https://www.google.com/maps?q=${fromServer.o},${fromServer.p}`;
         document.getElementById('panel_E_img').src = fromServer.l;
        document.getElementById('panel_E_h1').textContent = fromServer.f;
        document.getElementById('panel_F_img').src = fromServer.k;
        document.getElementById('panel_F_p').textContent = "Posée par " + fromServer.i;
        document.getElementById('panel_F_pb').textContent = fromServer.j;
        document.getElementById('panel_G_button').onclick = () => {
          window.open(`https://fleuread.onrender.com/historique?type=benne&id=${fromServer.a}`, '_blank');
          }
        }
// SCRIPT 9
let nowPanel;
      const inputB =  document.getElementById('cereale_input_search');
      // const resultContainer = document.getElementById('result_mapSearch');
      let thisvalueB;
      let debounceTimerB;
      
      inputB.addEventListener('input', async () => {
        clearTimeout(debounceTimerB);
        debounceTimerB = setTimeout(async () => {
        thisvalueB = inputB.value;
        const answer = await fetcher('smartsearchcereale',{value:thisvalueB, biobool:document.getElementById('bioounon').checked}, 'POST', sessionStorage.getItem('session_id'));
          
        if (answer.length < 1) {
         showToast("Aucune correspondance, consultez l'interface d'administration",'red');
        } else if (answer.length == 1) {
                 const content = {
                toupd : 'céréale',
                value_toupd : answer[0].search,
                eq:'num',
                value_eq:nowPanel
              };
              console.log(content);
              const responseServer = await fetcher('editbenne', content, 'POST', sessionStorage.getItem('session_id'));
                pushPanel(nowPanel);
          showToast("Modification enregistrée !",'blue');
          inputB.value = "";
        }
        }, 500);
      });
// SCRIPT 10
// let nowPanel;
      const inputA =  document.getElementById('farm_input_search');
      // const resultContainer = document.getElementById('result_mapSearch');
      let thisvalueA;
      let debounceTimerA;
      
      inputA.addEventListener('input', async () => {
        clearTimeout(debounceTimerA);
        debounceTimerA = setTimeout(async () => {
        thisvalueA = inputA.value;
        const answer = await fetcher('smartsearchfarm',{value:thisvalueA}, 'POST', sessionStorage.getItem('session_id'));
          
        if (answer.length < 1) {
         showToast("Aucune correspondance, consultez l'interface d'administration",'red');
        } else if (answer.length == 1) {
                 const content = {
                toupd : 'id_client',
                value_toupd : answer[0].search,
                eq:'num',
                value_eq:nowPanel
              };
              console.log(content);
              const responseServer = await fetcher('editbenne', content, 'POST', sessionStorage.getItem('session_id'));
                pushPanel(nowPanel);
          showToast("Modification enregistrée !",'blue');
          inputA.value = "";
        }
        }, 500);
      });

      async function disconnect () {
        console.log("DISCONNECTION");
        sessionStorage.removeItem('session_id');
        localStorage.removeItem('offtoken');
        
        start();
      
      }
// SCRIPT 11
 let onshow = false;
      let changerState = false;
      document.getElementById('move_benne').addEventListener('click', function () {
        changerState = true;
        console.log(changerState);
        showToast("Cliquez sur la carte pour placer la benne dans moins de 15 secondes.", 'blue');
        setTimeout(() => {
          changerState = false;
        }, 15000);
      })

      async function reloadBenne () {
        document.getElementById('filtrerBennes').click();
        plotPoints();
        if (onshow) {
        pushPanel(nowPanel);
        }
      }

      document.getElementById('bioounon').addEventListener('change', async function () {
        const value = document.getElementById('bioounon').checked;
        console.log(value);
        if (value) {
          document.getElementById('bio_temoin').textContent = "Oui";
        } else {
          document.getElementById('bio_temoin').textContent = "Non";
        }
      });
// SCRIPT 12
 async function showAdmin () {
        // nowPanel
        document.getElementById('adminBtn').click();
        document.getElementById('btnBennes').click();
        document.getElementById('text_searcherBenne').value = `B${nowPanel}A${nowPanel}`;
        document.getElementById('filtrerBennes').click();
      }
      async function showMap (id) {
        // nowPanel
        document.getElementById('close-btnB').click(); // Fermer Pop-up
        console.log("Step 1");
        document.getElementById('visuBtn').click(); // Afficher la carte
        console.log("Step 2");
        setTimeout(() => {
        document.getElementById('mapSearch_input').value = `FOCUS:${id}`;
          document.getElementById('mapSearch_input').dispatchEvent(new Event('input', { bubbles: true }));
          console.log("Step 3");
        pushPanel(id);
          console.log("Step 4");
        }, 1000);
      }
// SCRIPT 13
async function selectOptionByText (text) {
        const selecter = document.getElementById("society_select");
        let counter = 0;
        for (const opt of selecter.options) {
          if (opt.value == text) {
            selecter.selectedIndex = counter;
          }
          counter += 1;
        }
      }

      document.getElementById("society_select").addEventListener('change', async function () {
        const content = {
          toupd : 'society',
          value_toupd : document.getElementById("society_select").value,
          eq:'num',
          value_eq:nowPanel
        };
        console.log(content);
        const responseServer = await fetcher('editbenne', content, 'POST', sessionStorage.getItem('session_id'));
          pushPanel(nowPanel);
      });
// SCRIPT 14
 document.getElementById('createDPT').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = await Object.fromEntries(formData.entries());
        const content = {
          donnee:data.name,
          value:`${data.longitude},${data.latitude},${data.radius}`
        };
        const fromServer = await fetcher('createdepot', content, 'POST', sessionStorage.getItem('session_id'));
        showToast(`Création du dépôt : ${data.name} !`);
        putParams('no');
        document.getElementById('createDPT').reset();
      });

      async function removeStorage(value_eq) {
        const content = {
          value_eq: value_eq
        }
        if (confirm("Voulez-vous vraiment supprimer ce dépôt ?")) {
          if (confirm("Action irréversible...")) {
        await fetcher('deletestore', content, 'POST', sessionStorage.getItem('session_id'));
          }
        }
      }






