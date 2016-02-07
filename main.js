var net = require('net');
var randomstring = require('randomstring');

var HOST = '0.0.0.0';
var PORT = 4545;

var clients = {};
var games = {};

// Create a server instance, and chain the listen function to it
// The function passed to net.createServer() becomes the event handler for the 'connection' event
// The sock object the callback function receives UNIQUE for each connection
net.createServer(function(sock) {

    // We have a connection - a socket object is assigned to the connection automatically
    console.log('CONNECTED: ' + getEndpoint(sock));

	clients[getEndpoint(sock)] = {
		sock: sock,
		gameId: undefined
	};

    // Add a 'data' event handler to this instance of socket
    sock.on('data', function(data) {
		var dataStr = trim(data + "");
		if (dataStr.length == 0) {
			return;
		}
		if (dataStr.toLowerCase() == "newgame") {
			var gameId = randomstring.generate(7);
			games[gameId] = {
				player1: getEndpoint(sock),
				player2: undefined,
				p1Choice: "",
				p2Choice: ""
			};
			clients[getEndpoint(sock)].gameId = gameId;
			sock.write(gameId + "\n");
		}  else if (dataStr[0].toLowerCase() == "m") {
			var msg = dataStr.substr(dataStr.indexOf(" ") + 1).replace("\r", "").replace("\n", "");
			if (clients[getEndpoint(sock)].gameId === undefined) {
				sock.write("error nogame\n");
				return;
			}

			var gameId = clients[getEndpoint(sock)].gameId;
			sock.write("ok\n");
			
			if (games[gameId].player1 === getEndpoint(sock)) {
				sendMessage(games[gameId].player2, "MSG: " + msg + "\n");
			} else { // TODO: more than 2 players?
				sendMessage(games[gameId].player1, "MSG: " + msg + "\n");
			}
		} else if (dataStr[0].toLowerCase() == "j") {
			var parts = dataStr.split(" ");
			if (parts.length != 2) {
				sock.write("error syntax\n");
				return;
			}

			var gameId = parts[1];
			if (games[gameId] === undefined) {
				sock.write("error badcode\n");
				return;
			}
			if (games[gameId].player2 !== undefined) {
				sock.write("error inprog\n");
				return;
			}

			// set state
			clients[getEndpoint(sock)].gameId = gameId;
			games[gameId].player2 = getEndpoint(sock);

			// and start!
			sendMessage(games[gameId].player1, "start\n");
			sendMessage(games[gameId].player2, "start\n");
		} else if (dataStr[0].toLowerCase() == "r" || dataStr[0].toLowerCase() == "p" || dataStr[0].toLowerCase() == "s") {
			var choice = dataStr[0];
			if (clients[getEndpoint(sock)].gameId === undefined) {
				sock.write("error nogame\n");
				return;
			}

			var gameId = clients[getEndpoint(sock)].gameId;

			if (games[gameId].player1 === getEndpoint(sock)) {
				games[gameId].p1Choice = dataStr[0];
			} else { // TODO: more than 2 players?
				games[gameId].p2Choice = dataStr[0];
			}

			sock.write("ok\n");

			// check if both have been set
			if (games[gameId].p1Choice !== "" && games[gameId].p2Choice !== "") {
				// ok, send choices
				sendMessage(games[gameId].player1, games[gameId].p2Choice + "\n");
				sendMessage(games[gameId].player2, games[gameId].p1Choice + "\n");

				// and reset them
				games[gameId].p1Choice = "";
				games[gameId].p2Choice = "";
			}
		}
        console.log('DATA ' + getEndpoint(sock) + ': ' + trim(data));

    });

    // Add a 'close' event handler to this instance of socket
    sock.on('close', function(data) {
        console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
    });

    sock.write("hello\n");

}).listen(PORT, HOST);

console.log('Server listening on ' + HOST +':'+ PORT);

function getEndpoint(sock) {
	return sock.remoteAddress + ':' + sock.remotePort;
}

function trim(str) {
	return (str + "").replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,'');
}

function sendMessage(to, what) {
	clients[to].sock.write(what);
}
