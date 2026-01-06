const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

let gameState = {
    players: {},
    bullets: [],
    walls: [],
    items: [],
    myPlayerId: null
};

let keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

let mousePos = { x: 0, y: 0 };
let playerName = 'Player'; // Default name

// Handle name input
const nameInput = document.getElementById('playerName');
const setNameBtn = document.getElementById('setNameBtn');
const nameInputContainer = document.getElementById('nameInputContainer');

function setPlayerName() {
    const inputName = nameInput.value.trim();
    if (inputName) {
        playerName = inputName.substring(0, 15); // Max 15 characters
        // Send name to server
        socket.emit('setPlayerName', playerName);
        // Hide name input after setting
        nameInputContainer.style.display = 'none';
        canvas.focus();
    }
}

setNameBtn.addEventListener('click', setPlayerName);
nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        setPlayerName();
    }
});

// Initialize player ID
socket.on('connect', () => {
    gameState.myPlayerId = socket.id;
    console.log('Connected to server:', socket.id);
    // Send default name on connect
    socket.emit('setPlayerName', playerName);
    // Focus canvas when connected so keyboard works immediately
    canvas.focus();
});

// Receive game state from server
socket.on('gameState', (state) => {
    // Preserve myPlayerId when updating game state
    const myId = gameState.myPlayerId;
    gameState = state;
    gameState.myPlayerId = myId; // Restore myPlayerId
    updatePlayerCount();
    updateScoreboard();
});

// Update player count display
function updatePlayerCount() {
    const count = Object.keys(gameState.players).length;
    document.getElementById('playerCount').textContent = `Players: ${count}`;
}

// Update scoreboard
function updateScoreboard() {
    const scoreboardContent = document.getElementById('scoreboardContent');
    if (!scoreboardContent || !gameState.players) {
        return;
    }
    
    // Convert players object to array and sort by kills (descending)
    const playersArray = Object.values(gameState.players)
        .map(player => ({
            id: player.id,
            name: player.name || 'Player',
            kills: player.kills || 0
        }))
        .sort((a, b) => b.kills - a.kills); // Sort descending by kills
    
    // Clear existing content
    scoreboardContent.innerHTML = '';
    
    // Add each player to scoreboard
    playersArray.forEach((player, index) => {
        const isMyPlayer = player.id === gameState.myPlayerId;
        const item = document.createElement('div');
        item.className = `scoreboard-item ${isMyPlayer ? 'my-player' : ''}`;
        
        const rank = document.createElement('span');
        rank.className = 'rank';
        rank.textContent = `${index + 1}.`;
        
        const name = document.createElement('span');
        name.className = 'player-name';
        name.textContent = player.name;
        
        const kills = document.createElement('span');
        kills.className = 'player-kills';
        kills.textContent = `${player.kills} kills`;
        
        item.appendChild(rank);
        item.appendChild(name);
        item.appendChild(kills);
        scoreboardContent.appendChild(item);
    });
}

// Handle keyboard input
document.addEventListener('keydown', (e) => {
    // Don't handle WASD keys when typing in the name input field
    if (document.activeElement === nameInput) {
        return;
    }
    
    // Prevent default behavior for game keys
    if (e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'a' || 
        e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
    }
    
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        keys[key] = true;
        // Don't send immediately - let the interval handle it for consistent speed
    }
});

document.addEventListener('keyup', (e) => {
    // Don't handle WASD keys when typing in the name input field
    if (document.activeElement === nameInput) {
        return;
    }
    
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        keys[key] = false;
        // Don't send immediately - let the interval handle it for consistent speed
    }
});

// Ensure canvas can receive focus for keyboard events
canvas.setAttribute('tabindex', '0');
canvas.addEventListener('click', () => {
    canvas.focus();
    // Hide status message when canvas is clicked
    const statusMsg = document.getElementById('statusMessage');
    if (statusMsg) {
        statusMsg.classList.add('hidden');
    }
});

// Left mouse click to shoot (mousedown for better responsiveness)
canvas.addEventListener('mousedown', (e) => {
    // Only shoot on left mouse button (button 0)
    if (e.button === 0) {
        e.preventDefault(); // Prevent text selection
        socket.emit('shoot');
    }
});

// Hide status message when canvas gets focus
canvas.addEventListener('focus', () => {
    const statusMsg = document.getElementById('statusMessage');
    if (statusMsg) {
        statusMsg.classList.add('hidden');
    }
});

// Handle mouse movement for aiming
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
    // Don't send immediately - just update mouse position
    // The interval will send movement updates at consistent rate
});

// Send player movement to server
function sendPlayerMove() {
    if (!gameState.myPlayerId || !gameState.players || !gameState.players[gameState.myPlayerId]) {
        return;
    }
    
    const player = gameState.players[gameState.myPlayerId];
    if (!player) {
        return;
    }
    
    const dx = mousePos.x - (player.x + player.width / 2);
    const dy = mousePos.y - (player.y + player.height / 2);
    const angle = Math.atan2(dy, dx);
    
    socket.emit('playerMove', {
        keys: { ...keys }, // Send a copy of keys object
        angle: angle
    });
}

// Draw functions
function drawWall(wall) {
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
}

function drawTank(player, isMyPlayer = false) {
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.rotate(player.angle);
    
    // Tank body
    ctx.fillStyle = isMyPlayer ? '#3498db' : '#e74c3c';
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    // Tank outline
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    // Tank barrel
    ctx.fillStyle = '#34495e';
    ctx.fillRect(player.width / 2 - 5, -3, 15, 6);
    
    ctx.restore();
    
        // Health bar
        if (player.health < 100) {
            const barWidth = player.width;
            const barHeight = 4;
            const healthPercent = player.health / 100;
            
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(player.x, player.y - 8, barWidth, barHeight);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(player.x, player.y - 8, barWidth * healthPercent, barHeight);
        }
        
        // Draw boost indicators
        const now = Date.now();
        if (player.speedBoost && player.speedBoost > now) {
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚡', player.x + player.width / 2, player.y + player.height + 12);
        }
        if (player.damageBoost && player.damageBoost > now) {
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('★', player.x + player.width / 2, player.y + player.height + 24);
        }
}

function drawBullet(bullet) {
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawItem(item) {
    ctx.save();
    
    // Pulsing animation effect
    const time = Date.now();
    const pulse = Math.sin(time / 200) * 0.2 + 1; // Pulse between 0.8 and 1.2
    const size = item.width * pulse;
    const offsetX = item.x + (item.width - size) / 2;
    const offsetY = item.y + (item.height - size) / 2;
    
    // Draw item based on type
    switch (item.type) {
        case 'health':
            // Red cross for health
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(offsetX + size * 0.3, offsetY + size * 0.1, size * 0.4, size * 0.8);
            ctx.fillRect(offsetX + size * 0.1, offsetY + size * 0.3, size * 0.8, size * 0.4);
            break;
        case 'speed':
            // Blue lightning bolt for speed
            ctx.fillStyle = '#3498db';
            ctx.beginPath();
            ctx.moveTo(offsetX + size * 0.5, offsetY);
            ctx.lineTo(offsetX + size * 0.3, offsetY + size * 0.5);
            ctx.lineTo(offsetX + size * 0.4, offsetY + size * 0.5);
            ctx.lineTo(offsetX + size * 0.2, offsetY + size);
            ctx.lineTo(offsetX + size * 0.5, offsetY + size * 0.6);
            ctx.lineTo(offsetX + size * 0.4, offsetY + size * 0.6);
            ctx.lineTo(offsetX + size * 0.7, offsetY);
            ctx.closePath();
            ctx.fill();
            break;
        case 'damage':
            // Orange star for damage
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            const centerX = offsetX + size / 2;
            const centerY = offsetY + size / 2;
            const spikes = 5;
            const outerRadius = size / 2;
            const innerRadius = size / 4;
            for (let i = 0; i < spikes * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI) / spikes - Math.PI / 2;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();
            break;
        default:
            // Default circle
            ctx.fillStyle = '#95a5a6';
            ctx.beginPath();
            ctx.arc(offsetX + size / 2, offsetY + size / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();
    }
    
    // Glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, size, size);
    
    ctx.restore();
}

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw walls
    gameState.walls.forEach(wall => drawWall(wall));
    
    // Draw items
    if (gameState.items) {
        gameState.items.forEach(item => drawItem(item));
    }
    
    // Draw bullets
    gameState.bullets.forEach(bullet => drawBullet(bullet));
    
    // Draw players
    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        const isMyPlayer = playerId === gameState.myPlayerId;
        drawTank(player, isMyPlayer);
        
        // Draw player name above tank
        if (player.name) {
            ctx.fillStyle = isMyPlayer ? '#3498db' : '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(player.name, player.x + player.width / 2, player.y - 8);
            ctx.fillText(player.name, player.x + player.width / 2, player.y - 8);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();

// Send movement updates at fixed rate (throttled to prevent too many updates)
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 1000 / 60; // 60 FPS for network updates (smooth gameplay)

function updateLoop(currentTime) {
    // Throttle updates to prevent too many rapid updates
    if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
        sendPlayerMove();
        lastUpdateTime = currentTime;
    }
    requestAnimationFrame(updateLoop);
}

// Start update loop
requestAnimationFrame(updateLoop);

