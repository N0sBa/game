const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const gameState = {
  players: {},
  bullets: [],
  walls: generateWalls(),
  items: [],
  lastUpdate: Date.now()
};

// Track last movement update time per player (for throttling)
const playerLastMoveTime = {};
const MIN_MOVE_INTERVAL = 1000 / 60; // Max 60 updates per second per player (60 FPS)

// Item system configuration
const ITEM_TYPES = {
  HEALTH: 'health',
  SPEED: 'speed',
  DAMAGE: 'damage'
};

const ITEM_SPAWN_INTERVAL = 5000; // Spawn item every 5 seconds
const ITEM_LIFETIME = 15000; // Items disappear after 15 seconds
const MAX_ITEMS = 5; // Maximum items on map at once
let lastItemSpawnTime = Date.now();

// Generate walls (simple grid pattern)
function generateWalls() {
  const walls = [];
  const gridSize = 20;
  const tileSize = 32;
  
  // Create border walls
  for (let i = 0; i < gridSize; i++) {
    walls.push({ x: i * tileSize, y: 0, width: tileSize, height: tileSize });
    walls.push({ x: i * tileSize, y: (gridSize - 1) * tileSize, width: tileSize, height: tileSize });
    walls.push({ x: 0, y: i * tileSize, width: tileSize, height: tileSize });
    walls.push({ x: (gridSize - 1) * tileSize, y: i * tileSize, width: tileSize, height: tileSize });
  }
  
  // Add some random inner walls
  for (let i = 2; i < gridSize - 2; i += 3) {
    for (let j = 2; j < gridSize - 2; j += 3) {
      if (Math.random() > 0.5) {
        walls.push({ x: i * tileSize, y: j * tileSize, width: tileSize, height: tileSize });
      }
    }
  }
  
  return walls;
}

// Generate random position that doesn't collide with walls
function getRandomItemPosition() {
  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    const x = 50 + Math.random() * (640 - 100);
    const y = 50 + Math.random() * (640 - 100);
    const itemRect = { x, y, width: 20, height: 20 };
    
    // Check collision with walls
    let collides = false;
    for (const wall of gameState.walls) {
      if (checkCollision(itemRect, wall)) {
        collides = true;
        break;
      }
    }
    
    if (!collides) {
      return { x, y };
    }
  }
  // Fallback position if no valid position found
  return { x: 100, y: 100 };
}

// Spawn a random item
function spawnItem() {
  if (gameState.items.length >= MAX_ITEMS) {
    return; // Don't spawn if max items reached
  }
  
  const itemTypes = Object.values(ITEM_TYPES);
  const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  const position = getRandomItemPosition();
  
  const item = {
    id: Date.now() + Math.random(),
    type: randomType,
    x: position.x,
    y: position.y,
    width: 20,
    height: 20,
    spawnTime: Date.now()
  };
  
  gameState.items.push(item);
}

// Update items (remove expired ones)
function updateItems() {
  const now = Date.now();
  gameState.items = gameState.items.filter(item => {
    return (now - item.spawnTime) < ITEM_LIFETIME;
  });
  
  // Spawn new items at intervals
  if (now - lastItemSpawnTime >= ITEM_SPAWN_INTERVAL) {
    spawnItem();
    lastItemSpawnTime = now;
  }
}

// Check and handle item collection
function checkItemCollection() {
  gameState.items = gameState.items.filter(item => {
    const itemRect = { x: item.x, y: item.y, width: item.width, height: item.height };
    
    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (checkCollision(itemRect, player)) {
        // Player collected item
        applyItemEffect(player, item.type);
        return false; // Remove item
      }
    }
    
    return true; // Keep item
  });
}

// Apply item effect to player
function applyItemEffect(player, itemType) {
  switch (itemType) {
    case ITEM_TYPES.HEALTH:
      player.health = Math.min(100, player.health + 30);
      break;
    case ITEM_TYPES.SPEED:
      // Speed boost will be handled in movement (temporary boost)
      if (!player.speedBoost) {
        player.speedBoost = Date.now() + 10000; // 10 second boost
      } else {
        player.speedBoost = Math.max(player.speedBoost, Date.now() + 10000);
      }
      break;
    case ITEM_TYPES.DAMAGE:
      // Damage boost will be handled in bullet damage (temporary boost)
      if (!player.damageBoost) {
        player.damageBoost = Date.now() + 10000; // 10 second boost
      } else {
        player.damageBoost = Math.max(player.damageBoost, Date.now() + 10000);
      }
      break;
  }
}

// Collision detection
function checkCollision(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.y + rect1.height > rect2.y;
}

// Update bullets
function updateBullets() {
  gameState.bullets = gameState.bullets.filter(bullet => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    
    // Check wall collision
    for (const wall of gameState.walls) {
      if (checkCollision(bullet, wall)) {
        return false; // Remove bullet
      }
    }
    
    // Check player collision
    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (playerId !== bullet.playerId && checkCollision(bullet, player)) {
        // Player hit!
        const shooter = gameState.players[bullet.playerId];
        const damage = (shooter && shooter.damageBoost && shooter.damageBoost > Date.now()) ? 20 : 10;
        player.health -= damage;
        if (player.health <= 0) {
          // Award kill to the shooter
          if (shooter) {
            shooter.kills = (shooter.kills || 0) + 1;
          }
          // Respawn the killed player
          player.health = 100;
          player.x = 100 + Math.random() * 400;
          player.y = 100 + Math.random() * 400;
          // Clear boosts on death
          player.speedBoost = null;
          player.damageBoost = null;
        }
        return false; // Remove bullet
      }
    }
    
    // Remove if out of bounds
    return bullet.x > 0 && bullet.x < 640 && bullet.y > 0 && bullet.y < 640;
  });
}

// Game loop
setInterval(() => {
  updateBullets();
  updateItems();
  checkItemCollection();
  gameState.lastUpdate = Date.now();
  io.emit('gameState', gameState);
}, 1000 / 60); // 60 FPS

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Create new player
  const playerId = socket.id;
  gameState.players[playerId] = {
    id: playerId,
    x: 100 + Math.random() * 400,
    y: 100 + Math.random() * 400,
    angle: 0,
    health: 100,
    width: 32,
    height: 32,
    name: 'Player', // Default name
    kills: 0, // Initialize kills counter
    speedBoost: null, // Speed boost timer
    damageBoost: null // Damage boost timer
  };
  
  // Send initial game state
  socket.emit('gameState', gameState);
  
  // Handle player name change
  socket.on('setPlayerName', (name) => {
    if (gameState.players[playerId]) {
      // Sanitize name (remove special characters, limit length)
      const sanitizedName = name.toString().trim().substring(0, 15).replace(/[<>]/g, '');
      if (sanitizedName) {
        gameState.players[playerId].name = sanitizedName;
      }
    }
  });
  
  // Handle player movement
  socket.on('playerMove', (data) => {
    if (gameState.players[playerId]) {
      // Throttle movement updates to prevent too many rapid updates
      const now = Date.now();
      const lastMoveTime = playerLastMoveTime[playerId] || 0;
      
      if (now - lastMoveTime < MIN_MOVE_INTERVAL) {
        return; // Skip this update, too soon
      }
      
      playerLastMoveTime[playerId] = now;
      
      const player = gameState.players[playerId];
      // Check if player has speed boost
      const hasSpeedBoost = player.speedBoost && player.speedBoost > Date.now();
      const speed = hasSpeedBoost ? 5 : 3; // Boosted speed is faster
      
      let newX = player.x;
      let newY = player.y;
      
      if (data.keys.w) {
        newY -= speed;
      }
      if (data.keys.s) {
        newY += speed;
      }
      if (data.keys.a) {
        newX -= speed;
      }
      if (data.keys.d) {
        newX += speed;
      }
      
      // Update angle
      if (data.angle !== undefined) {
        player.angle = data.angle;
      }
      
      // Check wall collision before moving
      const newPlayerRect = { x: newX, y: newY, width: player.width, height: player.height };
      let canMove = true;
      
      for (const wall of gameState.walls) {
        if (checkCollision(newPlayerRect, wall)) {
          canMove = false;
          break;
        }
      }
      
      if (canMove) {
        player.x = newX;
        player.y = newY;
      }
    }
  });
  
  // Handle shooting
  socket.on('shoot', (data) => {
    if (gameState.players[playerId]) {
      const player = gameState.players[playerId];
      const bulletSpeed = 5; // Slower bullets for easier dodging
      const bullet = {
        id: Date.now() + Math.random(),
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        vx: Math.cos(player.angle) * bulletSpeed,
        vy: Math.sin(player.angle) * bulletSpeed,
        playerId: playerId,
        width: 8,
        height: 8
      };
      gameState.bullets.push(bullet);
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete gameState.players[playerId];
    delete playerLastMoveTime[playerId];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to play`);
});

