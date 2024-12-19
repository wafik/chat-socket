const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));

// User tracking
const users = {};

io.on('connection', (socket) => {
    console.log('New user connected');

    // User joins a room
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        users[socket.id] = { username, room };

        // Notify all clients in the room about the updated user list
        io.to(room).emit('updateUsers', getUsersInRoom(room));

        // Broadcast join message
        socket.broadcast.to(room).emit('message', { 
            username: 'System', 
            message: `${username} has joined the chat.`,
            timestamp: getTimestamp() 
        });
    });

    // Handle chat messages
    socket.on('chatMessage', (data) => {
        const user = users[socket.id];
        console.log(data.message);
        console.log(data.message?.length);
        if (user) {
            io.to(user.room).emit('message', {
                username: user.username,
                message: data.message,
                timestamp: getTimestamp(),
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            const { room, username } = user;
            delete users[socket.id];

            // Notify all clients in the room about the updated user list
            io.to(room).emit('updateUsers', getUsersInRoom(room));

            // Broadcast leave message
            io.to(room).emit('message', {
                username: 'System',
                message: `${username} has left the chat.`,
                timestamp: getTimestamp(),
            });
        }
        console.log('User disconnected');
    });
});

// Helper function: Get users in a room
function getUsersInRoom(room) {
    return Object.values(users).filter(user => user.room === room);
}

// Helper function: Generate timestamp
function getTimestamp() {
    return new Date().toLocaleTimeString();
}

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
