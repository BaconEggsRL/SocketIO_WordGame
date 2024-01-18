/* index.js -- serverside express/socket.io code */

console.log("START")

var fs = require("fs");
var text1 = fs.readFileSync("./words.txt", "utf-8");
var text2 = fs.readFileSync("./words_alpha.txt", "utf-8");
let text = text1.concat(text2);
const regex_newline = /\r?\n/;
var words = text.split(regex_newline);

console.log("DONE")

//////////////////////////////////////////

const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

/* Allows us to use css files in project directory */
app.use(express.static(__dirname));

/* Serve requests to the homepage "/" by sending the index.html file. */
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

/* Serve web socket connections */
let turn_user;
const users = [];
const history = [];
const sentence = [];
const maxHistory = 10;
io.on('connection', (socket) => {

    // prompt for name and join
    socket.emit('init', users, words);

    /////////////////////////////////////////////////////
    // on client

    // check if username is valid
    socket.on("is_valid", (temp_name, callback) => {
        // init
        let msg = "";
        let stat = false;

        // check if valid:
        let long = "Sorry, that username is too long.\n\n"
        let taken = "Sorry, that username is already taken.\n\n"
        // too long (20-characters + 6-characters = 26 limit.)
        if (temp_name.length > 26) {
            msg = msg + long
        }
        // taken
        for (let user of users)  {
            if (user.name == temp_name) {
                msg = msg + taken
                break;
            }
        }

        // return
        stat = (msg == "")  //true means no error message. so the username is valid.
        response = {
            status: stat,
            message: msg,
            users: users,
        }
        callback(response);
    });

    socket.on("get_users", (callback) => {
        // return
        response = {
            users: users,
        }
        callback(response);
    });

    socket.on("get_history", (callback) => {
        // return
        response = {
            history: history,
        }
        callback(response);
    });

    socket.on('user_join', (data) => {
        socket.username = data;
        if (users.length == 0) {
            turn_user = data;
        }
        users.push({
            id: socket.id,
            name: data,
        });
        console.log(users);
        // broadcast new user
        socket.broadcast.emit('user_join', {
            username: data,
        });
        io.emit('update_turn_user', {
            users: users,
            turn_user: turn_user,
        });
    });

    socket.on('disconnect', () => {

        // get next user
        var userPos = users.findIndex(usr => usr.id === socket.id)
        var userObj = users[userPos];
        var nextUserPos = (userPos + 1) % users.length;
        var nextUserObj = users[nextUserPos];
        console.log("userPos = " + userPos, ", name = " + userObj.name)
        console.log("nextUserPos = " + nextUserPos, ", next_name = " + nextUserObj.name)

        turn_user = nextUserObj.name

        // remove user
        users.splice(userPos, 1);
        console.log(users);

        socket.broadcast.emit('user_leave', {
            username: socket.username,
        });
        io.emit('update_turn_user', {
            users: users,
            turn_user: turn_user,
        });
    });

    // change current user
    socket.on('chat_message', (data) => {
        // get next user
        var userPos = users.map(function(x) {return x.name; }).indexOf(data.username);
        var userObj = users[userPos];
        var nextUserPos = (userPos + 1) % users.length;
        var nextUserObj = users[nextUserPos];

        if (turn_user != userObj.name) {
            console.log("turn_user = " + turn_user, ", Chat userObj.name = " + userObj.name)
            throw new Error("ERROR: USER MIS-MATCH");
        }

        console.log("userPos = " + userPos, ", name = " + userObj.name)
        console.log("nextUserPos = " + nextUserPos, ", next_name = " + nextUserObj.name)

        turn_user = nextUserObj.name;

        if (history.length >= maxHistory) {
            history.shift()  // remove oldest chat message
        }
        history.push(data)
        //console.log(history)
        socket.broadcast.emit('chat_message', {
            username: data.username, 
            message: data.message,
            color: data.color,
        });
        io.emit('update_turn_user', {
            users: users,
            turn_user: turn_user,
        });
    });

    // do not change current user
    socket.on('server_message', (data) => {
        if (history.length >= maxHistory) {
            history.shift()  // remove oldest chat message
        }
        history.push(data)
        //console.log(history)
        socket.broadcast.emit('chat_message', {
            username: data.username, 
            message: data.message,
            color: data.color,
        });
    });

    socket.on('broadcast_sentence', (data) => {
        socket.broadcast.emit('update_sentence', {
            sentence: data.sentence, 
        });
    });

    socket.on('user_typing', (data) => {
        socket.broadcast.emit('user_typing', {
            username: data.username, 
            typing: data.typing,
        });
    });

});

/* Listen on port 3000 */
server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});


/* Check names */
function checkNames() {
    // check if username not already being used:
    for (let user of users)  {
        console.log(user.name)
        if (user.name == data) {
            socket.emit('get_username');
            break;
        }
    }

    socket.username = data;
    users.push({
        id: socket.id,
        name: data,
    });
    socket.broadcast.emit('user_join', data);
    // else request different username:
}