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

// Client-side prediction state
let predictedState = {
    x: 0,
    y: 0,
    angle: 0
};

// Interpolation state for other players
let interpolatedPlayers = {};

let keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

let mousePos = { x: 0, y: 0 };
let playerName = 'Player'; // Default name

// Mobile touch controls
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let touchControls = {
    moveJoystick: {
        active: false,
        touchId: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        radius: 50
    },
    aimJoystick: {
        active: false,
        touchId: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        radius: 50,
        angle: 0
    }
};

// Auto-fire interval for mobile
let autoFireInterval = null;
const AUTO_FIRE_RATE = 250; // Fire every 250ms when aiming

// Sound system
const bgMusic = document.getElementById('bgMusic');
const killSound = document.getElementById('killSound');
let previousKills = 0; // Track previous kill count to detect new kills

// Game constants (must match server)
const PLAYER_SPEED = 3;
const PLAYER_SPEED_BOOST = 5;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 32;

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
    // Initialize kill tracking
    previousKills = 0;
    // Focus canvas when connected so keyboard works immediately
    canvas.focus();
});

// Receive game state from server
socket.on('gameState', (state) => {
    // Preserve myPlayerId when updating game state
    const myId = gameState.myPlayerId;
    
    // Update interpolated positions for other players
    const now = Date.now();
    for (const playerId in state.players) {
        if (playerId !== myId) {
            const serverPlayer = state.players[playerId];
            if (!interpolatedPlayers[playerId]) {
                interpolatedPlayers[playerId] = {
                    x: serverPlayer.x,
                    y: serverPlayer.y,
                    angle: serverPlayer.angle,
                    prevX: serverPlayer.x,
                    prevY: serverPlayer.y,
                    prevAngle: serverPlayer.angle,
                    updateTime: now
                };
            } else {
                // Store previous position for interpolation
                interpolatedPlayers[playerId].prevX = interpolatedPlayers[playerId].x;
                interpolatedPlayers[playerId].prevY = interpolatedPlayers[playerId].y;
                interpolatedPlayers[playerId].prevAngle = interpolatedPlayers[playerId].angle;
                // Update to new server position
                interpolatedPlayers[playerId].x = serverPlayer.x;
                interpolatedPlayers[playerId].y = serverPlayer.y;
                interpolatedPlayers[playerId].angle = serverPlayer.angle;
                interpolatedPlayers[playerId].updateTime = now;
            }
            // Copy other properties
            Object.assign(interpolatedPlayers[playerId], {
                health: serverPlayer.health,
                name: serverPlayer.name,
                kills: serverPlayer.kills,
                speedBoost: serverPlayer.speedBoost,
                damageBoost: serverPlayer.damageBoost,
                width: serverPlayer.width,
                height: serverPlayer.height
            });
        }
    }
    
    // Remove disconnected players from interpolation
    for (const playerId in interpolatedPlayers) {
        if (!state.players[playerId]) {
            delete interpolatedPlayers[playerId];
        }
    }
    
    // Server reconciliation for my player (smooth correction)
    if (myId && state.players[myId]) {
        const serverPlayer = state.players[myId];
        const predictedX = predictedState.x;
        const predictedY = predictedState.y;
        
        // Calculate difference
        const diffX = Math.abs(serverPlayer.x - predictedX);
        const diffY = Math.abs(serverPlayer.y - predictedY);
        
        // If difference is significant, smoothly correct
        if (diffX > 5 || diffY > 5) {
            // Smooth correction (lerp 20% towards server position)
            predictedState.x += (serverPlayer.x - predictedX) * 0.2;
            predictedState.y += (serverPlayer.y - predictedY) * 0.2;
        } else {
            // Small difference, just snap to server position
            predictedState.x = serverPlayer.x;
            predictedState.y = serverPlayer.y;
        }
        
        predictedState.angle = serverPlayer.angle;
    }
    
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
    
    // Check for new kills (kill sound detection)
    if (gameState.myPlayerId && gameState.players[gameState.myPlayerId]) {
        const myPlayer = gameState.players[gameState.myPlayerId];
        const currentKills = myPlayer.kills || 0;
        if (currentKills > previousKills) {
            // Player got a new kill!
            playKillSound();
            previousKills = currentKills;
        }
    }
    
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
    if (!isMobile) {
    canvas.focus();
    }
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
    if (!isMobile) {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
    // Don't send immediately - just update mouse position
    // The interval will send movement updates at consistent rate
    }
});

// Mobile touch controls - Dual Virtual Joysticks
let moveJoystickBase = null;
let moveJoystickHandle = null;
let aimJoystickBase = null;
let aimJoystickHandle = null;

function updateJoystickVisual(type) {
    const joystickData = type === 'move' ? touchControls.moveJoystick : touchControls.aimJoystick;
    const base = type === 'move' ? moveJoystickBase : aimJoystickBase;
    const handle = type === 'move' ? moveJoystickHandle : aimJoystickHandle;
    
    if (!handle || !base) return;
    
    if (!joystickData.active) {
        // Reset to center if not active
        handle.style.left = '50%';
        handle.style.top = '50%';
        handle.style.transform = 'translate(-50%, -50%)';
        return;
    }
    
    const dx = joystickData.currentX - joystickData.startX;
    const dy = joystickData.currentY - joystickData.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = joystickData.radius;
    
    let moveX = dx;
    let moveY = dy;
    
    if (distance > maxDistance) {
        moveX = (dx / distance) * maxDistance;
        moveY = (dy / distance) * maxDistance;
    }
    
    const rect = base.getBoundingClientRect();
    const baseCenterX = rect.width / 2;
    const baseCenterY = rect.height / 2;
    
    handle.style.left = (baseCenterX + moveX) + 'px';
    handle.style.top = (baseCenterY + moveY) + 'px';
    handle.style.transform = 'translate(-50%, -50%)';
}

function updateKeysFromMoveJoystick() {
    if (!touchControls.moveJoystick.active) return;
    
    const dx = touchControls.moveJoystick.currentX - touchControls.moveJoystick.startX;
    const dy = touchControls.moveJoystick.currentY - touchControls.moveJoystick.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const threshold = 15; // Minimum distance to register movement
    
    if (distance < threshold) {
        keys.w = false;
        keys.a = false;
        keys.s = false;
        keys.d = false;
        return;
    }
    
    const angle = Math.atan2(dy, dx);
    const normalizedDx = Math.cos(angle);
    const normalizedDy = Math.sin(angle);
    
    // Determine direction based on angle
    keys.w = normalizedDy < -0.4;
    keys.s = normalizedDy > 0.4;
    keys.a = normalizedDx < -0.4;
    keys.d = normalizedDx > 0.4;
}

function updateAimFromAimJoystick() {
    if (!touchControls.aimJoystick.active) return;
    if (!gameState.myPlayerId || !gameState.players[gameState.myPlayerId]) return;
    
    const dx = touchControls.aimJoystick.currentX - touchControls.aimJoystick.startX;
    const dy = touchControls.aimJoystick.currentY - touchControls.aimJoystick.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 10) return; // Dead zone
    
    // Calculate aim angle from joystick direction
    touchControls.aimJoystick.angle = Math.atan2(dy, dx);
    
    // Convert joystick direction to aim position on canvas
    const player = gameState.players[gameState.myPlayerId];
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    // Set aim point in the direction of the joystick, at a fixed distance
    const aimDistance = 100;
    mousePos.x = playerCenterX + Math.cos(touchControls.aimJoystick.angle) * aimDistance;
    mousePos.y = playerCenterY + Math.sin(touchControls.aimJoystick.angle) * aimDistance;
}

function startAutoFire() {
    if (autoFireInterval) return;
    // Fire immediately
    socket.emit('shoot');
    // Then fire at interval
    autoFireInterval = setInterval(() => {
        if (touchControls.aimJoystick.active) {
            socket.emit('shoot');
        }
    }, AUTO_FIRE_RATE);
}

function stopAutoFire() {
    if (autoFireInterval) {
        clearInterval(autoFireInterval);
        autoFireInterval = null;
    }
}

function initDualJoysticks() {
    moveJoystickBase = document.getElementById('moveJoystickBase');
    moveJoystickHandle = document.getElementById('moveJoystickHandle');
    aimJoystickBase = document.getElementById('aimJoystickBase');
    aimJoystickHandle = document.getElementById('aimJoystickHandle');
    
    if (!moveJoystickBase || !aimJoystickBase) return;
    
    // Move joystick touch handlers
    moveJoystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = moveJoystickBase.getBoundingClientRect();
        const touch = e.changedTouches[0];
        touchControls.moveJoystick.touchId = touch.identifier;
        touchControls.moveJoystick.startX = rect.left + rect.width / 2;
        touchControls.moveJoystick.startY = rect.top + rect.height / 2;
        touchControls.moveJoystick.currentX = touch.clientX;
        touchControls.moveJoystick.currentY = touch.clientY;
        touchControls.moveJoystick.active = true;
        updateJoystickVisual('move');
        updateKeysFromMoveJoystick();
    }, { passive: false });
    
    // Aim joystick touch handlers
    aimJoystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = aimJoystickBase.getBoundingClientRect();
        const touch = e.changedTouches[0];
        touchControls.aimJoystick.touchId = touch.identifier;
        touchControls.aimJoystick.startX = rect.left + rect.width / 2;
        touchControls.aimJoystick.startY = rect.top + rect.height / 2;
        touchControls.aimJoystick.currentX = touch.clientX;
        touchControls.aimJoystick.currentY = touch.clientY;
        touchControls.aimJoystick.active = true;
        updateJoystickVisual('aim');
        updateAimFromAimJoystick();
        startAutoFire();
    }, { passive: false });
    
    // Global touch move handler for both joysticks
    document.addEventListener('touchmove', (e) => {
        let handled = false;
        
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            
            // Handle move joystick
            if (touchControls.moveJoystick.active && touch.identifier === touchControls.moveJoystick.touchId) {
                touchControls.moveJoystick.currentX = touch.clientX;
                touchControls.moveJoystick.currentY = touch.clientY;
                updateJoystickVisual('move');
                updateKeysFromMoveJoystick();
                handled = true;
            }
            
            // Handle aim joystick
            if (touchControls.aimJoystick.active && touch.identifier === touchControls.aimJoystick.touchId) {
                touchControls.aimJoystick.currentX = touch.clientX;
                touchControls.aimJoystick.currentY = touch.clientY;
                updateJoystickVisual('aim');
                updateAimFromAimJoystick();
                handled = true;
            }
        }
        
        if (handled) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Global touch end handler
    document.addEventListener('touchend', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            
            // Handle move joystick release
            if (touchControls.moveJoystick.active && touch.identifier === touchControls.moveJoystick.touchId) {
                touchControls.moveJoystick.active = false;
                touchControls.moveJoystick.touchId = null;
                keys.w = false;
                keys.a = false;
                keys.s = false;
                keys.d = false;
                updateJoystickVisual('move');
            }
            
            // Handle aim joystick release
            if (touchControls.aimJoystick.active && touch.identifier === touchControls.aimJoystick.touchId) {
                touchControls.aimJoystick.active = false;
                touchControls.aimJoystick.touchId = null;
                stopAutoFire();
                updateJoystickVisual('aim');
            }
        }
    }, { passive: false });
    
    // Touch cancel handler
    document.addEventListener('touchcancel', (e) => {
        touchControls.moveJoystick.active = false;
        touchControls.moveJoystick.touchId = null;
        touchControls.aimJoystick.active = false;
        touchControls.aimJoystick.touchId = null;
        keys.w = false;
        keys.a = false;
        keys.s = false;
        keys.d = false;
        stopAutoFire();
        updateJoystickVisual('move');
        updateJoystickVisual('aim');
    }, { passive: false });
}

// Prevent default touch behaviors on canvas for mobile
canvas.addEventListener('touchstart', (e) => {
    if (isMobile) e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (isMobile) e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (isMobile) e.preventDefault();
}, { passive: false });

// Send player movement to server
function sendPlayerMove() {
    if (!gameState.myPlayerId || !gameState.players || !gameState.players[gameState.myPlayerId]) {
        return;
    }
    
    const player = gameState.players[gameState.myPlayerId];
    if (!player) {
        return;
    }
    
    let angle;
    
    // On mobile, use aim joystick angle directly when active
    if (isMobile && touchControls.aimJoystick.active) {
        angle = touchControls.aimJoystick.angle;
    } else {
        // Use mouse position for desktop or when aim joystick not active
    const dx = mousePos.x - (player.x + player.width / 2);
    const dy = mousePos.y - (player.y + player.height / 2);
        angle = Math.atan2(dy, dx);
    }
    
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

// Sound management functions
// Load background music from /audio/bgmusic.mp3
async function setBackgroundMusic() {
    const audioPath = '/audio/bgmusic.mp3';
    
    console.log('Loading background music from:', audioPath);
    
    // Clear previous source
    bgMusic.pause();
    bgMusic.src = '';
    bgMusic.load();
    
    // Set audio file path
    bgMusic.src = audioPath;
    bgMusic.loop = true; // Ensure infinite loop
    bgMusic.volume = 0.5; // Set volume to 50%
    
    // Load the audio source
    bgMusic.load();
    
    // Wait for audio to be ready
    bgMusic.addEventListener('canplaythrough', () => {
        console.log('Background music ready to play');
        // Try to play, but handle autoplay restrictions
        bgMusic.play().then(() => {
            console.log('Background music started');
        }).catch(error => {
            console.warn('Could not autoplay background music:', error);
            console.log('Music will start when user interacts with the page');
        });
    }, { once: true });
    
    bgMusic.addEventListener('error', (e) => {
        console.error('Background music error:', e);
        console.error('Audio element error:', bgMusic.error);
        if (bgMusic.error) {
            const errorMessages = {
                1: 'MEDIA_ERR_ABORTED - The user aborted the loading',
                2: 'MEDIA_ERR_NETWORK - A network error occurred',
                3: 'MEDIA_ERR_DECODE - The audio file is corrupted or format not supported',
                4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - The audio format is not supported or file not found'
            };
            const errorMsg = errorMessages[bgMusic.error.code] || bgMusic.error.message;
            console.error('Error code:', bgMusic.error.code);
            console.error('Error message:', errorMsg);
            console.error(`Failed to load background music from ${audioPath}. Please ensure the file exists in public/audio/ folder.`);
        }
    });
}

// Load kill sound from /audio/killsound.mp3
async function setKillSound() {
    const audioPath = '/audio/killsound.mp3';
    
    console.log('Loading kill sound from:', audioPath);
    
    // Clear previous source
    killSound.pause();
    killSound.src = '';
    killSound.load();
    
    // Set audio file path
    killSound.src = audioPath;
    killSound.volume = 0.7; // Set volume to 70%
    
    // Load the audio source
    killSound.load();
    
    // Wait for audio to be ready
    killSound.addEventListener('canplaythrough', () => {
        console.log('Kill sound ready to play');
    }, { once: true });
    
    killSound.addEventListener('error', (e) => {
        console.error('Kill sound error:', e);
        console.error('Audio element error:', killSound.error);
        if (killSound.error) {
            const errorMessages = {
                1: 'MEDIA_ERR_ABORTED - The user aborted the loading',
                2: 'MEDIA_ERR_NETWORK - A network error occurred',
                3: 'MEDIA_ERR_DECODE - The audio file is corrupted or format not supported',
                4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - The audio format is not supported or file not found'
            };
            const errorMsg = errorMessages[killSound.error.code] || killSound.error.message;
            console.error('Error code:', killSound.error.code);
            console.error('Error message:', errorMsg);
            console.error(`Failed to load kill sound from ${audioPath}. Please ensure the file exists in public/audio/ folder.`);
        }
    });
}

function playKillSound() {
    if (killSound.src && killSound.src !== window.location.href) {
        killSound.currentTime = 0; // Reset to start
        killSound.play().catch(error => {
            console.warn('Could not play kill sound:', error);
        });
    }
}

// Initialize mobile controls and responsive canvas
function initMobileControls() {
    // Update controls info text
    const controlsInfo = document.getElementById('controlsInfo');
    if (controlsInfo) {
        if (isMobile) {
            controlsInfo.textContent = 'Left joystick: Move | Right joystick: Aim & Auto-fire';
        } else {
            controlsInfo.textContent = 'Controls: WASD to move, Mouse to aim and shoot';
        }
    }
    
    // Show/hide mobile controls
    const mobileControlsContainer = document.getElementById('mobileControlsContainer');
    if (mobileControlsContainer) {
        mobileControlsContainer.style.display = isMobile ? 'flex' : 'none';
    }
    
    // Initialize dual joysticks if on mobile
    if (isMobile) {
        initDualJoysticks();
    }
    
    // Make canvas responsive
    function resizeCanvas() {
        const container = canvas.parentElement;
        if (container && isMobile) {
            const maxWidth = Math.min(window.innerWidth - 40, 640);
            const maxHeight = Math.min(window.innerHeight * 0.7, 640);
            const size = Math.min(maxWidth, maxHeight);
            canvas.style.width = size + 'px';
            canvas.style.height = size + 'px';
        } else {
            canvas.style.width = '';
            canvas.style.height = '';
        }
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 100);
    });
}

// Initialize audio files on page load
window.addEventListener('load', () => {
    // Load audio files directly from /audio/ folder
    setBackgroundMusic();
    setKillSound();
    // Initialize mobile controls
    initMobileControls();
});

// Start background music when user interacts (to bypass autoplay restrictions)
let musicStarted = false;
function startMusicOnInteraction() {
    if (!musicStarted && bgMusic.src && bgMusic.src !== window.location.href) {
        bgMusic.play().then(() => {
            musicStarted = true;
            console.log('Background music started on user interaction');
        }).catch(error => {
            console.warn('Could not start background music:', error);
        });
    }
}

// Listen for user interactions to start music
document.addEventListener('click', startMusicOnInteraction, { once: true });
document.addEventListener('keydown', startMusicOnInteraction, { once: true });
canvas.addEventListener('click', startMusicOnInteraction, { once: true });

