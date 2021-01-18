'use strict';
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

const chatForm = document.getElementById('chat-form');
const chatMessage = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const enterRoom = document.getElementById('enterRoom');
const sendButton = document.getElementById('send');
const callButton = document.getElementById('call');
const answerButton = document.getElementById('answer');
const hangupButton = document.getElementById('hangup');
const leaveButton = document.getElementById('leave');
var mainArea = document.getElementById('mainArea');
const roomData = document.getElementById('roomData');
const answerDiv = document.getElementById('answerDiv');
const fullScreen = document.getElementById('fullScreen');
var audio = new Audio('media/bensound-tenderness.mp3');
var messageTone = new Audio('media/message.mp3');

var isInitiator;
var newPeer = false;
var pcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

//Get username and room from URL
const {username, room} = Qs.parse(location.search, {
  ignoreQueryPrefix:true
});

//window.room = prompt("Enter room name:");
//var room = "ABC";

var socket = io.connect();

if (room !== "") {
  console.log('Message from client: Asking to join room ' + room);
  socket.emit('create or join', {username, room});
}

socket.on('created', function(room, clientId) {
  //isInitiator = true;
  console.log("Is initiator:" + isInitiator);
});

socket.on('full', function(room) {
  alert(`Room is full. Go back to home!`);
  window.location.replace("localhost:3000/index.html");
  msg.disabled = true;
  sendButton.disabled = true;
  console.log('Message from client: Room ' + room + ' is full :^(');
});

socket.on("join", function (room) {
  //console.log("Another peer made a request to join room " + room);
  //console.log("This peer is the initiator of room " + room + "!");
  isChannelReady = true;
});

socket.on("joined", function (room) {
  //console.log("joined: " + room);
  isChannelReady = true;
});

socket.on('roomUsers', ({room, users})=>{
  outputRoomName(room);
  outputUsers(users);
})

//==========================================

function sendMessage(message) {
  console.log("Client sending message: ", message);
  socket.emit("message", message);
}

// This client receives a message
socket.on("message", function (message) {
  console.log("Client received message:", message);
  if (message === "got user media") {
    maybeStart();
  } else if (message.type === "offer") {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === "answer" && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === "candidate" && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });
    pc.addIceCandidate(candidate);
  } else if (message === "bye" && isStarted) {
    hangupButton.style="display:none";
    callButton.style = "display:block";
    handleRemoteHangup();
  } 
  
});

/////////////////////////////////////////
var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");
  
callButton.addEventListener('click', async ()=>{
  console.log("Call buton clicked")
  hangupButton.style = "display:block";
  callButton.style = "display:none";
  hideMainArea();
  roomData.style = "display:none";
  localVideo.style = "display:block";

  socket.emit("clickCall")
  isInitiator = false;

  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .then(gotStream)
    .catch(function (e) {
      alert("getUserMedia() error: " + e.name);
    });
})

answerButton.addEventListener('click', ()=>{
  hangupButton.style = "display:block";
  answerButton.style = "display:none";
  roomData.style = "display:none";
  localVideo.style = "display:block";
  window.navigator.vibrate(0);
  audio.pause();
  audio.currentTime = 0;
  isInitiator = true;

  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .then(gotStream)
    .catch(function (e) {
      alert("getUserMedia() error: " + e.name);
    });
})

     function gotStream(stream) {
      console.log("Adding local stream.");
      localStream = stream;
      localVideo.srcObject = stream;
      console.log("isInitiator:"+isInitiator);
      if (isInitiator) {
        maybeStart();
      }  
    }

    hangupButton.addEventListener('click', ()=>{
      hangupButton.style = 'display:none';
      answerButton.style = 'display:none';
      callButton.style = 'display:block';
      localVideo.style = "display:none";
      //remoteVideo.style = "display:none";
      mainArea.style = "display:block";
      roomData.style = "display:block";
      audio.pause();
      audio.currentTime = 0;

      if(isStarted){
        hangup();
        fullScreen.style="display:none";
        remoteVideo.style = "display:none";
        socket.emit("clickHangup");
      }else{
        socket.emit("selfHangup");
      }
    })
    
    var constraints = {
      video: true,
    };
    
    console.log("Getting user media with constraints", constraints);
    
    if (location.hostname !== "localhost") {
      requestTurn(
        "https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913"
      );
    }

    function maybeStart() {
      console.log(">>>>>>> maybeStart() ", isStarted, localStream, isChannelReady);
      if (!isStarted && typeof localStream !== "undefined" && isChannelReady) {
        console.log(">>>>>> creating peer connection");
        createPeerConnection();
        pc.addStream(localStream);
        console.log(pc);
        isStarted = true;
        console.log("isInitiator", isInitiator);
        if (isInitiator) {
          doCall();
        }
      }
    }
    
    window.onbeforeunload = function () {
      sendMessage("bye");
    };

    ///////////////////////////////////////////////
    function createPeerConnection() {
      try {
        pc = new RTCPeerConnection(pcConfig);
        pc.onicecandidate = handleIceCandidate;
        pc.onaddstream = handleRemoteStreamAdded;
        pc.onremovestream = handleRemoteStreamRemoved;
        console.log("Created RTCPeerConnnection");
      } catch (e) {
        console.log("Failed to create PeerConnection, exception: " + e.message);
        alert("Cannot create RTCPeerConnection object.");
        return;
      }
    }
    
    function handleIceCandidate(event) {
      console.log("icecandidate event: ", event);
      if (event.candidate) {
        sendMessage({
          type: "candidate",
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        });
      } else {
        console.log("End of candidates.");
      }
    }
    
    function handleCreateOfferError(event) {
      console.log("createOffer() error: ", event);
    }
    
    function doCall() {
      console.log("Sending offer to peer");
      pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
    }
    
    function doAnswer() {
      console.log("Sending answer to peer.");
      pc.createAnswer().then(
        setLocalAndSendMessage,
        onCreateSessionDescriptionError
      );
    }
    
    function setLocalAndSendMessage(sessionDescription) {
      pc.setLocalDescription(sessionDescription);
      console.log("setLocalAndSendMessage sending message", sessionDescription);
      sendMessage(sessionDescription);
    }
    
    function onCreateSessionDescriptionError(error) {
      trace("Failed to create session description: " + error.toString());
    }
    
    function requestTurn(turnURL) {
      var turnExists = false;
      for (var i in pcConfig.iceServers) {
        if (pcConfig.iceServers[i].urls.substr(0, 5) === "turn:") {
          turnExists = true;
          turnReady = true;
          break;
        }
      }
      if (!turnExists) {
        console.log("Getting TURN server from ", turnURL);
        // No TURN server. Get one from computeengineondemand.appspot.com:
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && xhr.status === 200) {
            var turnServer = JSON.parse(xhr.responseText);
            console.log("Got TURN server: ", turnServer);
            pcConfig.iceServers.push({
              urls: "turn:" + turnServer.username + "@" + turnServer.turn,
              credential: turnServer.password,
            });
            turnReady = true;
          }
        };
        xhr.open("GET", turnURL, true);
        xhr.send();
      }
    }
    
    function handleRemoteStreamAdded(event) {
      console.log("Remote stream added.");
      remoteStream = event.stream;
      remoteVideo.srcObject = remoteStream;
      remoteVideo.style ="display:block";
      setTimeout(()=>{
        fullScreen.style = "display:block"; 
      }, 1000)
      
      
    }
    
    function handleRemoteStreamRemoved(event) {
      console.log("Remote stream removed. Event: ", event);
    }
    
    function hangup() {
      console.log("Hanging up.");
      stop();
      sendMessage("bye");
    }
    
    function handleRemoteHangup() {
      console.log("Session terminated.");
      stop();
      isInitiator = false;
    }
    
    function stop() {
      isStarted = false;
      pc.close();
      pc = null;
    }

socket.on('ipaddr', function(ipaddr) {
  console.log('Message from client: Server IP address is ' + ipaddr);
});

socket.on('joined', function(room, clientId) {
  isInitiator = false;
});

socket.on('chatMessage', message=>{
  console.log(message);
  outputMessage(message);

  chatMessage.scrollTop = chatMessage.scrollHeight;
})

//Send the messages from message field
chatForm.addEventListener('submit', e =>{
  e.preventDefault();

  //Get the typed message
  const msg = e.target.elements.msg.value;

  //Sending messages to the server side
  socket.emit('chatMessage', msg);

  //Clear the message field and focus
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});

//Displaying message within the message box area
function outputMessage(message){
  const div = document.createElement('div');
  div.classList.add('message');
  div.innerHTML = `<p class="meta"><b><i>${message.username} <span>${message.time}</i></b></span>
      <br />
      ${message.text}
  </p>`;

  document.querySelector('.chat-messages').appendChild(div);

}

//Display room name
function outputRoomName(room){
  roomName.innerText = 
  room;
}

//Output users to DOM
function outputUsers(users){
  userList.innerHTML = `
      ${users.map(user=>`<h6>${user.username}</h6>`).join('')}
  `;
}

//Change call button into answer
socket.on('clickCall', ()=>{
  callButton.style = "display:none";
  answerButton.style = "display:block";
  hangupButton.style = "display:block";
  hideMainArea();
  roomData.style = "display:none";
  audio.play();
  vibrateMobile();
})

//When the other peer clicked hangup button to end the call
socket.on('clickHangup',()=>{
  fullScreen.style="display:none";
  remoteVideo.style = "display:none";
  localVideo.style = "display:none";
  mainArea.style = "display:block";
  roomData.style = "display:block";
})

//When the caller clicked hangup button before starts the call
socket.on("selfHangup", ()=>{
  answerButton.style="display:none";
  callButton.style="display:block";
  localVideo.style="display:none";
  hangupButton.style="display:none";
  mainArea.style = "display:block";
  roomData.style = "display:block";
  audio.pause();
  audio.currentTime = 0;
})

//Fullscreen API
function getFullscreenElement(){
  return document.fullscreenElement
  ||document.webkitFullscreenElement
  ||document.mozFullscreenElement
  ||document.mozFullscreenElement;
}

function toggleFullscreenElement(){
  if(getFullscreenElement()){
    document.exitFullscreen();
  }
  else{
    document.getElementById("remoteVideo").requestFullscreen().catch(console.log);
  }
}

//Vibration effect for mobile devices
function vibrateMobile(){
  window.navigator.vibrate(10000);
  console.log("vibration started");
}

socket.on("messageTone",message=>{
  if(message.text!=="Welcome to Epsychiatry")
  messageTone.play();
})

fullScreen.addEventListener('click',()=>{
  toggleFullscreenElement();
})


leaveButton.addEventListener("click",()=>{
  location.replace("https://epsychiatry.com.au/")
})

//Detect the screen resolution
function hideMainArea(){
  if(window.screen){
    var width=screen.width;
    var height=screen.height;
    

    if(width<=992){
      mainArea.style="display:none";
    }
  }
}