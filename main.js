const http = require('http')
const ws = require('ws')
const random = require('random-name')

var connections = 0

const web_server = http.createServer((req, resp) => {
    if(req.url == "/") {
        let html_page = `
            <html>
            <body style="height: 100vh; overflow: hidden;">
                <div id="connections"><p>connections: 0</p></div>
                <p>Messages:</p>
                <div id="messages" style="height: 60vh; overflow-y: scroll; overflow-x: hidden">
                </div>
                <div>
                    <input type="text" id="send_text">
                    <button onclick="send()" id="send_btn">send</button>
                </div>

                <script>
                    var text = document.getElementById('send_text')
                    var messages = document.getElementById('messages')
                    var connections_container = document.getElementById('connections')

                    text.addEventListener("keyup", function(event) {
                        if (event.keyCode === 13) {
                          event.preventDefault();
                          document.getElementById("send_btn").click();
                        }
                      });

                    var server = new WebSocket('wss://' + location.host + '/wss')

                    var tagsToReplace = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;'
                    };
                    function replaceTag(tag) {
                        return tagsToReplace[tag] || tag;
                    }

                    function safe_tags_replace(str) {
                        return str.replace(/[&<>]/g, replaceTag);
                    }

                    server.onmessage = (message) => {
                        let parsed_msg = JSON.parse(message.data)
                        if (parsed_msg.message) {
                            messages.insertAdjacentHTML('beforeend', '<p>' + safe_tags_replace(parsed_msg.message) + '</p>')
                            messages.scrollTo(0,messages.scrollHeight);
                        }
                        if (parsed_msg.connections) {
                            connections_container.innerHTML = '<p>connections: ' + parsed_msg.connections + '</p>'
                        }
                    }

                    server.onopen = () => {
                        server.send(JSON.stringify({user: 'admin', pass: 'admin'}))
                    }

                    function send() {
                        server.send(JSON.stringify({message: text.value}))
                        text.value = ''
                    }
                </script>
            </body>
            </html>
        `

        resp.end(html_page)
    }
})

const wss = new ws.Server({server: web_server, path: "/wss"})
wss.on('connection', (conn) => {
    conn.authenticated = false
    conn.on('message', (message) => {
        var parsed_msg = JSON.parse(message)
        if(!conn.authenticated) {
            try {
                if(parsed_msg.user == "admin" && parsed_msg.pass == "admin") {
                    conn.authenticated = true
                    conn.name = random.first()
                    return
                }

                conn.send(JSON.stringify({error: "invalid credentials"}))
            } catch (error) {
                conn.send(JSON.stringify({error: "invalid format"}))
            }
            return
        }

        console.log("message: %s", message)
        wss.clients.forEach((el) => {
            if(el == conn) {
                return el.send(JSON.stringify({message: `Me :  ${parsed_msg.message}`}))
            }
            el.send(JSON.stringify({message: `${conn.name} :  ${parsed_msg.message}`}))
        })
    })

    conn.on('close', () => {
        connections--
        wss.clients.forEach((el) => {
            el.send(JSON.stringify({connections}))
        })
    })

    console.log("got connection")
    connections++
    wss.clients.forEach((el) => {
        el.send(JSON.stringify({connections}))
    })
})

const port = process.env.PORT || 3000;
web_server.listen(port, "0.0.0.0", () => {
    console.log("server started")
})
