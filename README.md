# 🎮 Tank Multiplayer Game

A real-time multiplayer tank battle game inspired by Tank 1990, playable in web browsers.

## 🎯 Game Features

- **Real-time Multiplayer**: Play with friends online simultaneously
- **Simple 2D Graphics**: Clean and simple visual style
- **Tank Battle**: Classic tank combat gameplay
- **Collision Detection**: Walls and player collisions
- **Health System**: Players have health and respawn when defeated

## 🎮 How to Play

### Controls:
- **W/A/S/D** - Move your tank (Up/Left/Down/Right)
- **Mouse** - Aim your tank (point mouse to aim)
- **Enter** - Shoot bullets

### Objective:
- Move around the map
- Shoot other players
- Avoid getting hit
- Last player standing wins!

## 🚀 Quick Start (Local Testing)

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org (version 14 or higher)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   - Go to http://localhost:3000
   - Open multiple tabs/windows to test multiplayer
   - Share your local IP with friends on same network

## 🌐 Deploy Online (Share with Friends)

To make your game accessible online so friends can join from anywhere, follow the deployment guide:

**👉 See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions**

### Quick Deployment Options:

1. **Railway** (Easiest - Recommended)
   - Go to https://railway.app
   - Connect GitHub repo
   - Auto-deploys in minutes

2. **Render** (Free tier available)
   - Go to https://render.com
   - Create Web Service
   - Connect GitHub repo

3. **Vercel** (Fast deployment)
   - Go to https://vercel.com
   - Import GitHub repo
   - Deploy with one click

## 📁 Project Structure

```
game/
├── server.js          # Backend server with Socket.io
├── package.json       # Node.js dependencies
├── public/            # Frontend files
│   ├── index.html     # Main HTML page
│   ├── style.css      # Styling
│   └── game.js        # Game client logic
├── DEPLOYMENT.md      # Detailed deployment guide
└── README.md          # This file
```

## 🛠️ Technology Stack

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5 Canvas + JavaScript
- **Real-time Communication**: WebSocket (via Socket.io)

## 📝 Development

### Run in development mode (with auto-reload):
```bash
npm run dev
```
(Requires nodemon: `npm install -g nodemon`)

### Project Requirements:
- Node.js 14+
- Modern web browser with WebSocket support

## 🎨 Customization

You can customize:
- **Game map**: Edit wall generation in `server.js` → `generateWalls()`
- **Tank colors**: Edit colors in `public/game.js` → `drawTank()`
- **Game speed**: Adjust update intervals in `server.js`
- **Bullet speed**: Change `bulletSpeed` in `server.js`

## 📖 Detailed Documentation

- **Deployment Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Server Configuration**: Check `server.js` comments
- **Client Code**: Check `public/game.js` comments

## 🤝 Sharing with Friends

Once deployed:
1. Get your public URL (e.g., `https://your-game.railway.app`)
2. Share the link via WhatsApp, Discord, Email, etc.
3. Friends can open in any browser and play immediately!

## ⚠️ Troubleshooting

**Game won't start?**
- Make sure Node.js is installed
- Run `npm install` first
- Check that port 3000 is available

**Players can't see each other?**
- Ensure all players use the same server URL
- Check browser console for errors
- Verify WebSocket connections are working

**Need help?**
- Check server logs
- Review browser console (F12)
- See DEPLOYMENT.md for platform-specific help

## 📄 License

MIT License - Feel free to use and modify!

---

**Enjoy playing with your friends! 🎮🚀**
