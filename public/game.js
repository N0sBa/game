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
    joystick: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        radius: 60,
        baseRadius: 60
    },
    aimTouch: {
        active: false,
        touchId: null,
        x: 0,
        y: 0
    }
};

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

// Mobile touch controls - Virtual Joystick
let joystickBase = null;
let joystickHandle = null;

function getTouchPos(e, touchIndex = 0) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[touchIndex] || e.changedTouches[touchIndex];
    return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        clientX: touch.clientX,
        clientY: touch.clientY
    };
}

function updateJoystickVisual() {
    if (!joystickHandle || !joystickBase || !touchControls.joystick.active) {
        // Reset to center if not active
        if (joystickHandle) {
            joystickHandle.style.left = '50%';
            joystickHandle.style.top = '50%';
            joystickHandle.style.transform = 'translate(-50%, -50%)';
        }
        return;
    }
    
    const dx = touchControls.joystick.currentX - touchControls.joystick.startX;
    const dy = touchControls.joystick.currentY - touchControls.joystick.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = touchControls.joystick.radius;
    
    let moveX = dx;
    let moveY = dy;
    
    if (distance > maxDistance) {
        moveX = (dx / distance) * maxDistance;
        moveY = (dy / distance) * maxDistance;
    }
    
    const rect = joystickBase.getBoundingClientRect();
    const baseCenterX = rect.width / 2;
    const baseCenterY = rect.height / 2;
    
    joystickHandle.style.left = (baseCenterX + moveX - joystickHandle.offsetWidth / 2) + 'px';
    joystickHandle.style.top = (baseCenterY + moveY - joystickHandle.offsetHeight / 2) + 'px';
    joystickHandle.style.transform = 'none';
}

function initJoystick() {
    joystickBase = document.getElementById('joystickBase');
    joystickHandle = document.getElementById('joystickHandle');
    
    if (!joystickBase || !joystickHandle) return;
    
    // Joystick touch handlers
    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = joystickBase.getBoundingClientRect();
        const touch = e.touches[0];
        touchControls.joystick.startX = rect.left + rect.width / 2;
        touchControls.joystick.startY = rect.top + rect.height / 2;
        touchControls.joystick.currentX = touch.clientX;
        touchControls.joystick.currentY = touch.clientY;
        touchControls.joystick.active = true;
        updateJoystickVisual();
    }, { passive: false });

    let joystickTouchId = null;
    
    document.addEventListener('touchmove', (e) => {
        if (touchControls.joystick.active) {
            // Find the touch that started on the joystick
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (joystickTouchId === null || touch.identifier === joystickTouchId) {
                    e.preventDefault();
                    touchControls.joystick.currentX = touch.clientX;
                    touchControls.joystick.currentY = touch.clientY;
                    updateJoystickVisual();
                    updateKeysFromJoystick();
                    if (joystickTouchId === null) {
                        joystickTouchId = touch.identifier;
                    }
                    break;
                }
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (touchControls.joystick.active) {
            let touchEnded = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId || joystickTouchId === null) {
                    touchEnded = true;
                    break;
                }
            }
            if (touchEnded) {
                e.preventDefault();
                touchControls.joystick.active = false;
                joystickTouchId = null;
                const rect = joystickBase.getBoundingClientRect();
                touchControls.joystick.currentX = rect.left + rect.width / 2;
                touchControls.joystick.currentY = rect.top + rect.height / 2;
                keys.w = false;
                keys.a = false;
                keys.s = false;
                keys.d = false;
                updateJoystickVisual();
            }
        }
    }, { passive: false });
}

function updateKeysFromJoystick() {
    if (!touchControls.joystick.active) return;
    
    const dx = touchControls.joystick.currentX - touchControls.joystick.startX;
    const dy = touchControls.joystick.currentY - touchControls.joystick.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const threshold = 20; // Minimum distance to register movement
    
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
    keys.w = normalizedDy < -0.5;
    keys.s = normalizedDy > 0.5;
    keys.a = normalizedDx < -0.5;
    keys.d = normalizedDx > 0.5;
}

// Canvas touch handlers for aiming and shooting
canvas.addEventListener('touchstart', (e) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    const pos = getTouchPos(e, 0);
    
    // Check if this touch is for aiming (not joystick)
    if (joystickBase) {
        const joystickRect = joystickBase.getBoundingClientRect();
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        // If touch is in joystick area, ignore it
        if (touchX >= joystickRect.left && touchX <= joystickRect.right &&
            touchY >= joystickRect.top && touchY <= joystickRect.bottom) {
            return;
        }
    }
    
    e.preventDefault();
    
    // Set aim position and shoot
    mousePos.x = pos.x;
    mousePos.y = pos.y;
    touchControls.aimTouch.active = true;
    touchControls.aimTouch.touchId = touch.identifier;
    touchControls.aimTouch.x = pos.x;
    touchControls.aimTouch.y = pos.y;
    
    // Shoot on touch
    socket.emit('shoot');
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (!isMobile) return;
    if (touchControls.aimTouch.active && !touchControls.joystick.active) {
        e.preventDefault();
        // Find the touch that matches our aim touch
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === touchControls.aimTouch.touchId) {
                const pos = getTouchPos(e, i);
                mousePos.x = pos.x;
                mousePos.y = pos.y;
                touchControls.aimTouch.x = pos.x;
                touchControls.aimTouch.y = pos.y;
                break;
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (!isMobile) return;
    if (touchControls.aimTouch.active) {
        e.preventDefault();
        // Check if our touch ended
        let touchEnded = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchControls.aimTouch.touchId) {
                touchEnded = true;
                break;
            }
        }
        if (touchEnded) {
            touchControls.aimTouch.active = false;
            touchControls.aimTouch.touchId = null;
        }
    }
}, { passive: false });

// Prevent default touch behaviors on canvas
canvas.addEventListener('touchcancel', (e) => {
    if (!isMobile) return;
    e.preventDefault();
    touchControls.aimTouch.active = false;
    touchControls.aimTouch.touchId = null;
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
    
    // Use touch aim position if active, otherwise use mouse position
    let aimX = mousePos.x;
    let aimY = mousePos.y;
    
    if (isMobile && touchControls.aimTouch.active) {
        aimX = touchControls.aimTouch.x;
        aimY = touchControls.aimTouch.y;
    }
    
    const dx = aimX - (player.x + player.width / 2);
    const dy = aimY - (player.y + player.height / 2);
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
            controlsInfo.textContent = 'Controls: Virtual Joystick to move, Touch to aim and shoot';
        } else {
            controlsInfo.textContent = 'Controls: WASD to move, Mouse to aim and shoot';
        }
    }
    
    // Show/hide mobile controls
    const joystickContainer = document.getElementById('joystickContainer');
    if (joystickContainer) {
        joystickContainer.style.display = isMobile ? 'block' : 'none';
    }
    
    // Initialize joystick if on mobile
    if (isMobile) {
        initJoystick();
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

