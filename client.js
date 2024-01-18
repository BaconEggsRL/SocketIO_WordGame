/* client.js -- clientside socket.io code */

//////////////////////////////////////////

// html
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const typing = document.getElementById('typing');
const users_field = document.getElementById('users_field');

// is_typing
var typing_timeout;
const typing_timeout_time = 2000;
var is_typing = false;


// regex
//const regex_punctuation = /["#$%&'()*+, -—\/:;<=>@[\]^_`{|}~]+[--]$/;
//const regex_emdash = /(--)$/;
const regex_endofsentence = /(?<![?.!])[?.!]{1,3}(?!([?.!]))$/;
const regex_midsentence = /[,:;]$/;


// init
let username;
let words;
let sentence = [];
let users = [];
let turn_user; // username of current turn

const socket = io();
socket.on("init", async function(users, server_words) {

    // list of users
    usr = ""
    if (users.length > 0) {
        usr = "Users online: \n"
        for (let user of users)  {
            usr = usr.concat(" - '", user.name, "'\n")
        }
        usr = usr.concat("\n")
    } else {
        usr = "No other users are currently online. \n\n"
    }

    // list of valid words
    words = new Set(server_words)

    ///////////////////////////////////////////////////////
    
    // loop prompt until we get a valid name
    let pmsg = "Please enter a unique username:\n(Usernames can be any valid string under 26 characters.)\n(Hit 'Cancel' to be assigned a random username.)\n"
    let err_msg = ""

    // ENTER LOOP
    looping = true
    err_msg = ""
    myLoop:
    while(looping) {
        // get temp name
        temp_name = prompt(usr + err_msg + pmsg, "");
        if (temp_name === null) {
            temp_name = 'guest-' + socket.id
        }
        // console.log('temp_name = ' + temp_name);

        // check if valid
        try {
            const response = await socket.timeout(5000).emitWithAck('is_valid', temp_name);
            // console.log('name is_valid = ' + response.status); // is_valid
            // console.log('name err_msg = ' + response.message); // err msg
            looping = !response.status
            err_msg = response.message
            users = response.users
        } catch (e) {
            // the server did not acknowledge the event in the given delay
            throw "APATT ERROR: No response."
        }

        // break
        if (!looping) {
            break;
        }
    }
    // EXIT LOOP

    // if valid, set username = temp_name
    username = temp_name;
    // if we are the only user, set turn user to us
    if (users.length == 0) {
        turn_user = username
    }

    // get message history
    try {
        const response = await socket.timeout(5000).emitWithAck('get_history');
        console.log('history = ' + response.history);
        for (let data of response.history)  {
            console.log(data.username + ": " + data.message)
            addMessage(data.username + ": " + data.message);
        }
    } catch (e) {
        // the server did not acknowledge the event in the given delay
        throw "APATT ERROR: No response."
    }

    // show join message
    addMessage("You have joined the chat as '" + username  + "'.", color="#ffcccb");
    socket.emit("user_join", username);

});

socket.on("user_join", function(data) {
    addMessage(data.username + " just joined the chat!", color="#ffcccb");
});

socket.on("user_leave", function(data) {
    addMessage(data.username + " has left the chat.", color="#ffcccb");
});

socket.on("chat_message", function(data) {
    addMessage(data.username + ": " + data.message, color=data.color);
});

socket.on("update_turn_user", function(data) {
    users = data.users;
    turn_user = data.turn_user;
    console.log("turn_user = ", turn_user)

    let msg = users.map(u => u.name).join(', ')
    msg = "Users online: " + msg
    regex = new RegExp(turn_user);
    console.log("regex = ", regex)

    //console.log("regex test = ", regex.test(msg)); // expect true
    msg = msg.replace(regex, "<em><b>" + String(turn_user) + "</b></em>")
    //let msg = JSON.stringify(users)
    //let msg = turn_user + ", " + turn_user;

    console.log("msg = ", msg)
    users_field.innerHTML = '<p>' + msg + '</p>';
});

socket.on("update_sentence", function(data) {
    sentence = data.sentence;
    console.log(sentence)
});

socket.on('user_typing', function(data){
    if (data.typing) {
        typing.innerHTML = '<p><em>' + data.username + ' is typing...</em></p>';
    } else {
        typing.innerHTML = ''
    }
});

/* Check if user is typing */
input.addEventListener('keyup', function() {
    if (turn_user == username) {
        if (input.value) {
            /* Only emit event if user was not typing before. */
            if (!is_typing) {
    
                // console.log(username + " is typing")
                is_typing = true
                socket.emit('user_typing', {
                    username: username,
                    typing: true,
                });
    
                clearTimeout(typing_timeout)
                typing_timeout = setTimeout(timeoutFunction, typing_timeout_time)
            }
            
        }
    }
})


// given string "word" determine if valid word in sentence
async function wordIsValid(word) {

    let end = false;

    // Check if it is our turn to type
    if (turn_user != username) {
        response = {
            status: false,
            message: "turn_user != username",
            end: false,
        }
        return response;
    }

    // Check for end-of-sentence punctuation.
    if (regex_endofsentence.test(word)) {
        word = word.replace(regex_endofsentence,"")
        console.log("word (end punc removed) = '" + word + "'");
        end = true;

        // If word was only punctuation: allow but only if sentence is not empty
        // Also add it to the last word so there isn't a weird space
        if (sentence.length > 0) {
            if (word.length == 0) {
                response = {
                    status: true,
                    message: "only_punc",  // this message pops last word and re-adds with punc
                    end: true,
                }
                return response;
            }
        }
    }

    // Check for mid-sentence punctation.
    if (regex_midsentence.test(word)) {
        word = word.replace(regex_midsentence,"")
        console.log("word (mid punc removed) = '" + word + "'");
        end = false;

        // If word was only punctuation: allow but only if sentence is not empty
        // Also add it to the last word so there isn't a weird space
        if (sentence.length > 0) {
            if (word.length == 0) {
                response = {
                    status: true,
                    message: "only_punc",  // this message pops last word and re-adds with punc
                    end: false,
                }
                return response;
            }
        }
    }

    // Word can't be an empty string
    if (word.length == 0) {
        response = {
            status: false,
            message: "empty string",
            end: false,
        }
        return response;
    }

    // Word must be 26 characters or less
    if (word.length > 26) {
        response = {
            status: false,
            message: "too long",
            end: false,
        }
        return response;
    }

    // First word must start with uppercase
    if (sentence.length == 0) {
        if (word[0].toUpperCase() != word[0]) {
            response = {
                status: false,
                message: "missing upper",
                end: false,
            }
            return response;
        }
    }
    
    // Word must be in word list, or be a number
    if (!words.has(word) && !words.has(word.toLowerCase()) && !words.has(word.toUpperCase())) {
        is_number = !isNaN(parseFloat(word)) && isFinite(word);
        if (is_number == false) {
            response = {
                status: false,
                message: "invalid word",
                end: false,
            }
            return response;
        }
    }

    // If nothing bad happened then return true
    response = {
        status: true,
        message: "",
        end: end,
    }
    return response;
}


/* Check if submit message and send to server */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (input.value) {
        // Check if valid word
        try {
            let word = String(input.value);
            if (sentence.length == 0) {
                word = word[0].toUpperCase() + word.slice(1);
            }

            console.log("word = '" + word + "'")
            const response = await wordIsValid(word);
            const is_valid = response.status
            const end_of_sentence = response.end
            const word_msg = response.message

            // Add word to sentence/chat if valid
            if (is_valid) {
                
                // Add message to chat
                addMessage(username + ": " + word);
                socket.emit("chat_message", {
                    username: username,
                    message: word,
                });

                // Add message to sentence
                if (word_msg != "only_punc") {
                    sentence.push(word);
                } else {
                    sentence.push(sentence.pop() + word);
                }
                
                // Add sentence to chat
                if (end_of_sentence) {
                    console.log('end = ' + end_of_sentence); // end sentence?
                    data = {
                        username: "Sentence",
                        message: "'" + sentence.join(' ') + "'",
                        color: "#96e2d8",
                    }
                    addMessage(data.username + ": " + data.message, color=data.color);
                    socket.emit("server_message", data);
                    sentence = [];
                }

                // update other clients with current sentence
                console.log(sentence)
                socket.emit("broadcast_sentence", {
                    sentence: sentence,
                })

            } else {
                // log error
                console.log('is_valid = ' + is_valid);  // is_valid
                console.log('err_msg = ' + response.message);  // err msg
            }

        } catch (e) {
            // the server did not acknowledge the event in the given delay
            throw "APATT ERROR: No response."
        }

        // Display typing notification
        socket.emit('user_typing', {
            username: username,
            typing: false,
        });

        // Reset input field
        input.value = '';
    }
});

/* Generic chat_message function */
function addMessage(message, color="#efefef") {
    const li = document.createElement("li");
    li.style.background = color;
    li.innerHTML = message;
    messages.appendChild(li);
    window.scrollTo(0, document.body.scrollHeight);
}

/* User typing timeout */
function timeoutFunction() {
    // console.log(username + " stopped typing")
    is_typing = false
    socket.emit('user_typing', {
        username: username,
        typing: false,
    });
}