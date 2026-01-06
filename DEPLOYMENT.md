# Deployment Guide - Tank Multiplayer Game

This guide will help you deploy your multiplayer tank game online so your friends can join and play together.

## Prerequisites

1. Node.js installed on your computer (version 14 or higher)
2. A GitHub account (for easy deployment)
3. An account on one of these platforms:
   - **Railway** (Recommended - Free tier available)
   - **Render** (Free tier available)
   - **Vercel** (Free tier available)

## Option 1: Deploy to Railway (Recommended)

Railway is the easiest option for Node.js applications with WebSocket support.

### Steps:

1. **Install dependencies locally first:**
   ```bash
   npm install
   ```

2. **Create a Railway account:**
   - Go to https://railway.app
   - Sign up with your GitHub account

3. **Create a new project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select this repository

4. **Configure the project:**
   - Railway will automatically detect Node.js
   - It will use the `package.json` to install dependencies
   - The start command is already set: `node server.js`

5. **Set environment variables (if needed):**
   - Railway will automatically set the PORT variable
   - No additional configuration needed

6. **Deploy:**
   - Railway will automatically deploy when you push to GitHub
   - Or click "Deploy" in the Railway dashboard

7. **Get your game URL:**
   - Once deployed, Railway will provide a URL like: `https://your-game-name.railway.app`
   - Share this URL with your friends!

## Option 2: Deploy to Render

### Steps:

1. **Create a Render account:**
   - Go to https://render.com
   - Sign up with your GitHub account

2. **Create a new Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

3. **Configure the service:**
   - **Name:** tank-multiplayer-game (or any name you like)
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or paid if you prefer)

4. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy your game
   - Wait for deployment to complete (usually 2-5 minutes)

5. **Get your game URL:**
   - Render provides a URL like: `https://your-game-name.onrender.com`
   - Share with your friends!

## Option 3: Deploy to Vercel

**Note:** Vercel requires a bit more configuration for WebSocket support.

### Steps:

1. **Create a Vercel account:**
   - Go to https://vercel.com
   - Sign up with your GitHub account

2. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

3. **Deploy:**
   ```bash
   vercel
   ```
   - Follow the prompts
   - The `vercel.json` file is already configured

4. **Get your game URL:**
   - Vercel will provide a URL like: `https://your-game-name.vercel.app`

## Testing Locally Before Deployment

Before deploying, test the game locally:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   - Go to http://localhost:3000
   - Open multiple browser tabs/windows to test multiplayer
   - Or share your local IP address with friends on the same network

## Sharing with Friends

Once deployed, you'll get a public URL. Share this URL with your friends:

1. **Copy the deployment URL** (e.g., `https://your-game.railway.app`)
2. **Send it to your friends** via:
   - WhatsApp
   - Email
   - Discord
   - Any messaging app
3. **They can open it in their browser** and play immediately!

## Troubleshooting

### Game not loading?
- Check that the server is running
- Check browser console for errors
- Make sure WebSocket connections are allowed (some networks block them)

### Players can't see each other?
- Ensure all players are using the same server URL
- Check that Socket.io is connecting (look for connection messages in server logs)

### Port issues?
- Most hosting platforms automatically set the PORT environment variable
- The server code already handles this: `process.env.PORT || 3000`

## Updating the Game

After making changes:

1. **Commit and push to GitHub:**
   ```bash
   git add .
   git commit -m "Update game"
   git push
   ```

2. **Platforms will auto-deploy:**
   - Railway, Render, and Vercel automatically redeploy on git push
   - Wait a few minutes for the new version to go live

## Free Tier Limitations

- **Railway:** 500 hours/month free, then $5/month
- **Render:** Free tier may spin down after inactivity (takes ~30 seconds to wake up)
- **Vercel:** Generous free tier for personal projects

## Need Help?

- Check the platform's documentation
- Look at server logs in the platform dashboard
- Test locally first to ensure everything works

Happy gaming! 🎮

