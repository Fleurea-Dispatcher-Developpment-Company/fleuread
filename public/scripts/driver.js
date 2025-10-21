const offset = -((new Date().getTimezoneOffset()) / 60);
     // console.log(offset);
      
          async function start() {
      url = new URL(window.location.href);
      sessionId = await sessionStorage.getItem('session_id');
      if (!sessionId) {
     //   console.log("Not connected");
        window.location.href = `https://${url.hostname}`; 
      } else {
        if (await check(sessionId)) {
     //   console.log("Connected");
       await connectWebSocket();
          await getMe();
        } else {
        sessionStorage.removeItem('session_id');
      //  console.log("Not connected");
        window.location.href = `https://${url.hostname}`; 
        }
      }
            readParams();
      }
      
      start();

      
      async function check(id) {
        const answer = await fetcher('checksession',{'id':id},'POST','noauth');
        const bool = answer.value;
      //  console.warn(bool);
        if (bool) {
      //    console.warn("true");
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
        if (mes.action == 'time') {
          document.getElementById('time').textContent = mes.value;
        }
          if (mes.action === 'disconnect') {
            //  console.log("A/B");
           //   console.log(mes.who);
          if (mes.who === localStorage.getItem('offtoken')) {
       //     console.log("B/B");
          disconnect();
          }
        }
           if (mes.action === 'reload') {
                        if (mes.what === "benne") {
                          if (onshow) {
                            findBenne(onlive);
                          }
                        }
             if (mes.what === "client") {
                          if (onshow) {
                            findBenne(onlive);
                          }
                        }
             if (mes.what === "compte") {
                          start();
                        }
                      }
      });
      }

let mydatas = {};
      
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

       const lightboxB = document.getElementById('lightboxB');
       const closeBtnB = document.getElementById('close-btnB');
       document.addEventListener('DOMContentLoaded', () => {
        closeBtnB.addEventListener('click', () => {
         lightboxB.style.display = 'none';
       });
       lightboxB.addEventListener('click', (e) => {
         if (e.target === lightboxB) {
           lightboxB.style.display = 'none';
         }
       });
       });
       async function checkWebSocket() {
        if (!socket || socket.readyState == WebSocket.CLOSED ||  socket.readyState == WebSocket.CLOSING) {
     //     console.log("WebSocket Inactif !");
          window.location.reload();
        } else {
     //     console.log("WebSocket Actif !");
        }
      }
      setInterval(checkWebSocket, 15*1000);
 document.getElementById('register_benne').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = await Object.fromEntries(formData.entries());
        registerBenne(data.num);
      });
let onlive;
       document.getElementById('find_benne').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = await Object.fromEntries(formData.entries());
        findBenne(data.num);
         onlive = data.num;
      });

      async function getPosition () {
    //    console.log("Lancement d'un getPosition");
        return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
       //   console.log("Obtention d'une position GPS");
       //   console.log(position);
          resolve({latitude:position.coords.latitude, longitude:position.coords.longitude, altitude:position.coords.altitude ?? "Inconnue"});
        },
            (error) => {
              let message;
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  message = "Autorisez la localisation";
                  break;
                  case error.POSITION_UNAVAILABLE:
                  message = "Activez la localisation";
                  break;
                default:message = "Erreur inconnue";
              }
              showToast(message,"red");
          console.error("Erreur:", error.message);
              reject(error);
        }, {
            enableHighAccuracy:true,
            timeout:10000,
            maximumAge:0
        }
      );
        });
      }

      async function registerBenne(id) {
        showPopup();
        const {latitude, longitude, altitude} = await getPosition();
          const content = {
          id:id,
          latitude:latitude,
          longitude:longitude,
          altitude:altitude
        };
       // console.log(content);
        const fromServer = await fetcher('registerbenne', content, 'POST', sessionStorage.getItem('session_id'));
        const link = fromServer.icon;
        const message = fromServer.message;
        const status = fromServer.status;
           if (status == "400") {
                  window.history.replaceState({}, document.title, window.location.pathname);
            }
        document.getElementById('lightH2B').textContent = "Terminé";
         document.getElementById('lightImgB').src = link;
         document.getElementById('lightPB').innerHTML = message;
        document.getElementById('register_benne').reset();
        return fromServer.status;
      }

      async function showPopup () {
        lightboxB.style.display = 'flex';
         document.getElementById('lightH2B').textContent = "En attente";
         document.getElementById('lightImgB').src = "https://cdn.pixabay.com/photo/2013/07/13/10/44/card-157700_1280.png";
         document.getElementById('lightPB').innerHTML = "Récupération des coordonnées GPS... <br><strong>Ne fermez pas l'application jusqu'à la fin de l'opération, s'il vous plaît !</strong>";
      }

      async function showResult () {
        document.getElementById('resultBar').style.display = 'flex';
        document.getElementById('searchBar').style.display = 'none';
        document.getElementById('resultContainer_text').innerHTML = "<strong>En attente...</strong>";
        document.getElementById('resultContainer_img').src = "https://cdn.pixabay.com/photo/2016/05/30/14/23/detective-1424831_1280.png";
      }

 async function readParams () {
        // showToast("Lecture des paramètres en cours...");
       
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const id = urlParams.get('benne');
       //   showToast(`Résult : ${id} / ${action}`);
      
      
            if (action == "register") {
          //    console.log("register");
          //    showToast("Demande d'enregistrement...");
              if (id) {
          //      console.log(`Nous allons enregistrer la benne ${id}`);
              //  showToast(`Nous allons enregistrer la benne ${id}`);
                document.getElementById('register').style.display='flex';
                document.getElementById('main').style.display='none';
                document.getElementById('find').style.display='none';
                // On ouvre la bonne page
                document.getElementById("input_id").value = id;
                document.getElementById('submitter_benne').click();
              }
            }
      }

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
let onshow = false;
         async function findBenne(id) {
           onshow = true;
        showResult();
          const content = {
          id:id,
            offset:offset
        };
     //   console.log(content);
        const fromServer = await fetcher('findbenne', content, 'POST', sessionStorage.getItem('session_id'));
        const link = fromServer.icon;
        const message = fromServer.message;
        const status = fromServer.status;
         document.getElementById('resultContainer_img').src = link;
         document.getElementById('resultContainer_text').innerHTML = message;
        document.getElementById('find_benne').reset();
        return fromServer.status;
      }

           async function disconnect () {
      //  console.log("DISCONNECTION");
        sessionStorage.removeItem('session_id');
        localStorage.removeItem('offtoken');
        
        start();
      
      }

