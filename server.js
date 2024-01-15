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
const users = [];
const history = [];
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
        users.push({
            id: socket.id,
            name: data,
        });
        console.log(users);
        // broadcast new user
        socket.broadcast.emit('user_join', data);
    });

    socket.on('disconnect', () => {
        users.splice(users.findIndex(usr => usr.id === socket.id), 1);
        console.log(users);
        socket.broadcast.emit('user_leave', socket.username);
    });

    socket.on('chat_message', (data) => {
        if (history.length >= maxHistory) {
            history.shift()  // remove oldest chat message
        }
        history.push(data)
        console.log(history)
        socket.broadcast.emit('chat_message', {
            username: data.username, 
            message: data.message,
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