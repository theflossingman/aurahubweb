const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    path: '/ws',
    verifyClient: (info) => {
        // Allow all connections - you can add authentication here if needed
        return true;
    }
});

// WebSocket connection handling
const clients = new Set();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection established');
    clients.add(ws);
    
    // Send current data to newly connected client
    ws.send(JSON.stringify({
        type: 'initial_data',
        data: {
            auraData,
            dailyAuraData,
            coinData,
            posts: loadPostsData(),
            comments: loadCommentsData()
        }
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(ws, data);
        } catch (error) {
            console.error('Invalid WebSocket message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
        clients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

function broadcastToClients(message) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'update_aura':
            handleAuraUpdate(ws, data);
            break;
        case 'new_post':
            handleNewPost(ws, data);
            break;
        case 'new_comment':
            handleNewComment(ws, data);
            break;
        case 'purchase':
            handlePurchase(ws, data);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleAuraUpdate(ws, data) {
    const { person, action, currentUser } = data;
    
    // Validation
    if (!person || !action || !currentUser) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid data'
        }));
        return;
    }
    
    const today = new Date().toDateString();
    if (dailyAuraData[currentUser].date !== today) {
        Object.keys(dailyAuraData[currentUser]).forEach(key => {
            if (key !== 'date') {
                dailyAuraData[currentUser][key] = 0;
            }
        });
        dailyAuraData[currentUser].date = today;
    }
    
    const incrementAmount = 25;
    const currentGivenToPerson = dailyAuraData[currentUser][person] || 0;
    const DAILY_POSITIVE_LIMIT = 500;
    const DAILY_NEGATIVE_LIMIT = -500;
    
    let response;
    
    if (action === 'increment') {
        if (currentGivenToPerson + incrementAmount > DAILY_POSITIVE_LIMIT) {
            response = {
                type: 'aura_error',
                error: `You've reached your daily limit of ${DAILY_POSITIVE_LIMIT} aura for ${person.charAt(0).toUpperCase() + person.slice(1)}!`
            };
        } else {
            auraData[person] += incrementAmount;
            dailyAuraData[currentUser][person] = currentGivenToPerson + incrementAmount;
            coinData[person] = (coinData[person] || 0) + 2;
            
            response = {
                type: 'aura_updated',
                data: {
                    auraData,
                    coinData,
                    person,
                    action,
                    currentUser,
                    amount: incrementAmount
                }
            };
        }
    } else if (action === 'decrement') {
        if (currentGivenToPerson - incrementAmount < DAILY_NEGATIVE_LIMIT) {
            response = {
                type: 'aura_error',
                error: `You've reached your daily negative limit of ${DAILY_NEGATIVE_LIMIT} aura for ${person.charAt(0).toUpperCase() + person.slice(1)}!`
            };
        } else {
            auraData[person] -= incrementAmount;
            dailyAuraData[currentUser][person] = currentGivenToPerson - incrementAmount;
            coinData[person] = Math.max(0, (coinData[person] || 0) - 1);
            coinData[currentUser] = Math.max(0, (coinData[currentUser] || 0) - 1);
            
            response = {
                type: 'aura_updated',
                data: {
                    auraData,
                    coinData,
                    person,
                    action,
                    currentUser,
                    amount: -incrementAmount
                }
            };
        }
    }
    
    if (response.type === 'aura_updated') {
        saveAuraData();
        broadcastToClients(response);
    } else {
        ws.send(JSON.stringify(response));
    }
}

function handleNewPost(ws, data) {
    const { post } = data;
    
    if (!post) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid post data'
        }));
        return;
    }
    
    try {
        const posts = loadPostsData();
        posts.unshift(post); // Add to beginning
        savePostsData(posts);
        
        broadcastToClients({
            type: 'new_post',
            data: { post, totalPosts: posts.length }
        });
    } catch (error) {
        console.error('Error saving post:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to save post'
        }));
    }
}

function handleNewComment(ws, data) {
    const { postId, comment } = data;
    
    if (!postId || !comment) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid comment data'
        }));
        return;
    }
    
    try {
        const comments = loadCommentsData();
        
        if (!comments[postId]) {
            comments[postId] = [];
        }
        
        const newComment = {
            id: Date.now(),
            text: comment.text,
            user: comment.user,
            avatar: comment.avatar,
            gradient: comment.gradient,
            time: new Date().toLocaleString(),
            timestamp: new Date().toISOString()
        };
        
        comments[postId].unshift(newComment);
        saveCommentsData(comments);
        
        broadcastToClients({
            type: 'new_comment',
            data: { postId, comment: newComment, totalComments: comments[postId].length }
        });
    } catch (error) {
        console.error('Error saving comment:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to save comment'
        }));
    }
}

function handlePurchase(ws, data) {
    const { userId, cost, item, itemType } = data;
    
    if (!userId || !cost || !item) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid purchase data'
        }));
        return;
    }
    
    if (coinData[userId] < cost) {
        ws.send(JSON.stringify({
            type: 'purchase_error',
            message: 'Insufficient coins'
        }));
        return;
    }
    
    const oldCoins = coinData[userId];
    coinData[userId] -= cost;
    
    if (itemType === 'background') {
        if (!purchasedBackgrounds[userId]) {
            purchasedBackgrounds[userId] = [];
        }
        if (!purchasedBackgrounds[userId].includes(item)) {
            purchasedBackgrounds[userId].push(item);
            savePurchasedBackgrounds(purchasedBackgrounds);
        }
    } else if (itemType === 'badge') {
        if (!purchasedBadges[userId]) {
            purchasedBadges[userId] = [];
        }
        if (!purchasedBadges[userId].includes(item)) {
            purchasedBadges[userId].push(item);
            savePurchasedBadges(purchasedBadges);
        }
    }
    
    saveAuraData();
    
    broadcastToClients({
        type: 'purchase_completed',
        data: {
            userId,
            item,
            itemType,
            cost,
            newBalance: coinData[userId],
            coinData
        }
    });
}

// Enable CORS for all routes
app.use(cors());

// Add WebSocket upgrade headers for reverse proxy compatibility
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Data persistence functions
const AURA_DATA_FILE = path.join(__dirname, 'aura-data.json');
const DAILY_AURA_DATA_FILE = path.join(__dirname, 'daily-aura-data.json');
const COIN_DATA_FILE = path.join(__dirname, 'coin-data.json');
const PASSWORD_DATA_FILE = path.join(__dirname, 'password-data.json');
const POSTS_DATA_FILE = path.join(__dirname, 'posts-data.json');
const COMMENTS_DATA_FILE = path.join(__dirname, 'comments-data.json');
const PURCHASED_BACKGROUNDS_FILE = path.join(__dirname, 'purchased-backgrounds.json');
const PURCHASED_BADGES_FILE = path.join(__dirname, 'purchased-badges.json');
const EQUIPPED_BADGES_FILE = path.join(__dirname, 'equipped-badges.json');
const ACTIVITY_LOG_FILE = path.join(__dirname, 'activity-log.json');

function loadAuraData() {
    try {
        if (fs.existsSync(AURA_DATA_FILE)) {
            const data = fs.readFileSync(AURA_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading aura data:', error);
    }
    return {
        max: 0,
        gigi: 0,
        marco: 0,
        dezi: 0,
        sevi: 0
    };
}

function loadDailyAuraData() {
    try {
        if (fs.existsSync(DAILY_AURA_DATA_FILE)) {
            const data = fs.readFileSync(DAILY_AURA_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading daily aura data:', error);
    }
    
    const today = new Date().toDateString();
    return {
        max: { 
            dezi: 0, 
            gigi: 0, 
            marco: 0, 
            sevi: 0, 
            date: today
        },
        gigi: { 
            max: 0, 
            dezi: 0, 
            marco: 0, 
            sevi: 0, 
            date: today
        },
        marco: { 
            max: 0, 
            gigi: 0, 
            dezi: 0, 
            sevi: 0, 
            date: today
        },
        dezi: { 
            max: 0, 
            gigi: 0, 
            marco: 0, 
            sevi: 0, 
            date: today
        },
        sevi: { 
            max: 0, 
            gigi: 0, 
            marco: 0, 
            dezi: 0, 
            date: today
        }
    };
}

function loadCoinData() {
    try {
        if (fs.existsSync(COIN_DATA_FILE)) {
            const data = fs.readFileSync(COIN_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading coin data:', error);
    }
    return {
        max: 0,
        gigi: 0,
        marco: 0,
        dezi: 0,
        sevi: 0
    };
}

function loadPasswordData() {
    try {
        if (fs.existsSync(PASSWORD_DATA_FILE)) {
            const data = fs.readFileSync(PASSWORD_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading password data:', error);
    }
    return {
        max: '1234',
        gigi: '1234',
        marco: '1234',
        dezi: '1234',
        sevi: '1234'
    };
}

function loadPostsData() {
    try {
        if (fs.existsSync(POSTS_DATA_FILE)) {
            const data = fs.readFileSync(POSTS_DATA_FILE, 'utf8');
            const posts = JSON.parse(data);
            console.log(`Loaded ${posts.length} posts from file`);
            
            // Check for image posts
            const imagePosts = posts.filter(post => post.type === 'image' && post.image);
            console.log(`Found ${imagePosts.length} image posts`);
            imagePosts.forEach(post => {
                console.log(`Image post from ${post.user}: image data length = ${post.image ? post.image.length : 0} characters`);
            });
            
            return posts;
        }
    } catch (error) {
        console.error('Error loading posts data:', error);
    }
    return [];
}

function savePostsData(posts) {
    try {
        fs.writeFileSync(POSTS_DATA_FILE, JSON.stringify(posts, null, 2));
        console.log('Posts data saved successfully');
    } catch (error) {
        console.error('Error saving posts data:', error);
    }
}

function loadCommentsData() {
    try {
        if (fs.existsSync(COMMENTS_DATA_FILE)) {
            const data = fs.readFileSync(COMMENTS_DATA_FILE, 'utf8');
            const comments = JSON.parse(data);
            console.log(`Loaded ${Object.keys(comments).length} posts with comments`);
            return comments;
        }
    } catch (error) {
        console.error('Error loading comments data:', error);
    }
    return {};
}

function saveCommentsData(comments) {
    try {
        fs.writeFileSync(COMMENTS_DATA_FILE, JSON.stringify(comments, null, 2));
        console.log('Comments data saved successfully');
    } catch (error) {
        console.error('Error saving comments data:', error);
    }
}

function loadPurchasedBackgrounds() {
    try {
        if (fs.existsSync(PURCHASED_BACKGROUNDS_FILE)) {
            const data = fs.readFileSync(PURCHASED_BACKGROUNDS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading purchased backgrounds data:', error);
    }
    return {
        max: [],
        gigi: [],
        marco: [],
        dezi: [],
        sevi: []
    };
}

function savePurchasedBackgrounds(purchasedBackgrounds) {
    try {
        fs.writeFileSync(PURCHASED_BACKGROUNDS_FILE, JSON.stringify(purchasedBackgrounds, null, 2));
        console.log('Purchased backgrounds data saved successfully');
    } catch (error) {
        console.error('Error saving purchased backgrounds data:', error);
    }
}

function loadPurchasedBadges() {
    try {
        if (fs.existsSync(PURCHASED_BADGES_FILE)) {
            const data = fs.readFileSync(PURCHASED_BADGES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading purchased badges data:', error);
    }
    return {
        max: [],
        gigi: [],
        marco: [],
        dezi: [],
        sevi: []
    };
}

function savePurchasedBadges(purchasedBadges) {
    try {
        fs.writeFileSync(PURCHASED_BADGES_FILE, JSON.stringify(purchasedBadges, null, 2));
        console.log('Purchased badges data saved successfully');
    } catch (error) {
        console.error('Error saving purchased badges data:', error);
    }
}

function loadEquippedBadges() {
    try {
        if (fs.existsSync(EQUIPPED_BADGES_FILE)) {
            const data = fs.readFileSync(EQUIPPED_BADGES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading equipped badges data:', error);
    }
    return {
        max: null,
        gigi: null,
        marco: null,
        dezi: null,
        sevi: null
    };
}

function saveEquippedBadges(equippedBadges) {
    try {
        fs.writeFileSync(EQUIPPED_BADGES_FILE, JSON.stringify(equippedBadges, null, 2));
        console.log('Equipped badges data saved successfully');
    } catch (error) {
        console.error('Error saving equipped badges data:', error);
    }
}

function loadActivityLog() {
    try {
        if (fs.existsSync(ACTIVITY_LOG_FILE)) {
            const data = fs.readFileSync(ACTIVITY_LOG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading activity log:', error);
    }
    return [];
}

function saveActivityLog(activityLog) {
    try {
        fs.writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(activityLog, null, 2));
        console.log('Activity log saved successfully');
    } catch (error) {
        console.error('Error saving activity log:', error);
    }
}

// Define all available badges
const ALL_BADGES = [
    "Aura King 👑",
    "Aura God",
    "Aura Overlord",
    "Certified Legend",
    "Top Giver",
    "Himothy",
    "The Chosen One",
    "Main Character",
    "Big Aura Energy",
    "Elite Status",
    "Coin Collector",
    "Marketplace Mogul",
    "Drip Investor",
    "Aura Millionaire",
    "Big Spender",
    "Crypto Cousin 😂",
    "Coin Hoarder",
    "Luxury Loader",
    "Drip Dealer",
    "Rich Behavior",
    "Certified Yapper",
    "Professional Lurker",
    "NPC Energy",
    "Side Quest King",
    "Delulu Certified",
    "Touch Grass 💀",
    "Chronically Online",
    "Goofy Goober",
    "Skill Issue",
    "No Thoughts Head Empty",
    "Chat Demon",
    "Reply Instantly",
    "Left On Read 💀",
    "Double Texter",
    "Ghoster",
    "Streak Lord 🔥",
    "Typing…",
    "Voice Note Warrior",
    "Seen It All",
    "Story Spammer",
    "XP Grinder",
    "Coin Farmer",
    "Tryhard Mode",
    "AFK Legend",
    "Speedrunner",
    "Casual Chaos",
    "RNG Blessed",
    "Loot Goblin",
    "Final Boss",
    "Clutch Master",
    "OG Member",
    "Day One",
    "Founder",
    "Beta Tester",
    "Limited Drop",
    "Legendary Pull",
    "Mythic Aura",
    "Ultra Rare",
    "Glitched Badge 👾",
    "One of One",
    "Lowkey Icon",
    "Highkey Famous",
    "Aura Radiant",
    "Vibe Master",
    "Chillest Alive",
    "Silent Flex",
    "Smooth Operator",
    "Energy Different",
    "Built Different",
    "Untouchable"
];

function savePasswordData() {
    try {
        console.log('Saving password data to file...');
        fs.writeFileSync(PASSWORD_DATA_FILE, JSON.stringify(passwordData, null, 2));
        console.log('Password data saved successfully');
    } catch (error) {
        console.error('Error saving password data:', error);
    }
}

function saveAuraData() {
    try {
        console.log('Saving data to files...');
        fs.writeFileSync(AURA_DATA_FILE, JSON.stringify(auraData, null, 2));
        fs.writeFileSync(DAILY_AURA_DATA_FILE, JSON.stringify(dailyAuraData, null, 2));
        console.log('Writing coin data to file:', COIN_DATA_FILE);
        console.log('Coin data being written:', JSON.stringify(coinData, null, 2));
        fs.writeFileSync(COIN_DATA_FILE, JSON.stringify(coinData, null, 2));
        console.log('Aura and coin data saved successfully');
        
        // Verify the file was written correctly
        const verifyData = JSON.parse(fs.readFileSync(COIN_DATA_FILE, 'utf8'));
        console.log('Verification - coin data in file after save:', JSON.stringify(verifyData, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Load data on startup
let auraData = loadAuraData();
let dailyAuraData = loadDailyAuraData();
let coinData = loadCoinData();
let passwordData = loadPasswordData();
let purchasedBackgrounds = loadPurchasedBackgrounds();
let purchasedBadges = loadPurchasedBadges();
let equippedBadges = loadEquippedBadges();
let activityLog = loadActivityLog();

console.log('Initial coin data loaded:', coinData);

// Daily reset function
function performDailyReset() {
    const today = new Date().toDateString();
    let resetPerformed = false;
    
    // Check if we need to reset for any user
    Object.keys(dailyAuraData).forEach(userId => {
        if (dailyAuraData[userId] && dailyAuraData[userId].date !== today) {
            // Reset this user's daily limits
            Object.keys(dailyAuraData[userId]).forEach(key => {
                if (key !== 'date') {
                    dailyAuraData[userId][key] = 0;
                }
            });
            dailyAuraData[userId].date = today;
            resetPerformed = true;
        }
    });
    
    if (resetPerformed) {
        saveAuraData();
        console.log(`[${new Date().toISOString()}] Daily aura limits reset for all users`);
    }
}

// Schedule daily reset at 4 AM
function scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(4, 0, 0, 0); // Set to 4 AM tomorrow
    
    const msUntil4AM = tomorrow.getTime() - now.getTime();
    
    console.log(`[${new Date().toISOString()}] Scheduled daily reset for ${tomorrow.toISOString()}`);
    
    setTimeout(() => {
        performDailyReset();
        // Schedule next day's reset
        scheduleDailyReset();
    }, msUntil4AM);
}

// Perform initial reset check and schedule daily resets
performDailyReset();
scheduleDailyReset();

// REST API endpoints
app.use(express.json({ limit: '50mb' })); // Increase limit for large base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

// Get aura data
app.get('/api/aura', (req, res) => {
    res.json({ auraData, dailyAuraData, coinData, passwordData });
});

// Get posts
app.get('/api/posts', (req, res) => {
    const posts = loadPostsData();
    res.json(posts);
});

// Save posts
app.post('/api/posts', (req, res) => {
    const { posts } = req.body;
    console.log('POST /api/posts received:', posts.length, 'posts');
    
    if (!Array.isArray(posts)) {
        return res.status(400).json({ error: 'Posts must be an array' });
    }
    
    // Check for image posts and log their sizes
    posts.forEach(post => {
        if (post.type === 'image' && post.image) {
            console.log(`Image post from ${post.user}: image data length = ${post.image.length} characters`);
        }
    });
    
    try {
        savePostsData(posts);
        console.log('Posts saved successfully to file');
        res.json({ success: true, posts });
    } catch (error) {
        console.error('Error saving posts:', error);
        res.status(500).json({ error: 'Failed to save posts', details: error.message });
    }
});

// Get comments for a post
app.get('/api/comments/:postId', (req, res) => {
    const { postId } = req.params;
    const comments = loadCommentsData();
    const postComments = comments[postId] || [];
    res.json(postComments);
});

// Add comment to a post
app.post('/api/comments/:postId', (req, res) => {
    const { postId } = req.params;
    const { comment } = req.body;
    
    console.log(`Adding comment to post ${postId}:`, comment);
    
    if (!comment || !comment.text || !comment.user) {
        return res.status(400).json({ error: 'Invalid comment data' });
    }
    
    try {
        const comments = loadCommentsData();
        
        // Initialize comments array for this post if it doesn't exist
        if (!comments[postId]) {
            comments[postId] = [];
        }
        
        // Add new comment
        const newComment = {
            id: Date.now(),
            text: comment.text,
            user: comment.user,
            avatar: comment.avatar,
            gradient: comment.gradient,
            time: new Date().toLocaleString(),
            timestamp: new Date().toISOString()
        };
        
        comments[postId].unshift(newComment); // Add to beginning (newest first)
        
        saveCommentsData(comments);
        console.log(`Comment added to post ${postId}. Total comments: ${comments[postId].length}`);
        
        res.json({ success: true, comment: newComment, totalComments: comments[postId].length });
    } catch (error) {
        console.error('Error saving comment:', error);
        res.status(500).json({ error: 'Failed to save comment', details: error.message });
    }
});

// Update aura (fallback REST API)
app.post('/api/aura', (req, res) => {
    const { person, action, currentUser } = req.body;
    console.log('POST /api/aura received:', { person, action, currentUser });
    
    // Same validation logic as WebSocket
    if (!person || !action || !currentUser) {
        return res.status(400).json({ error: 'Invalid data' });
    }
    
    const today = new Date().toDateString();
    if (dailyAuraData[currentUser].date !== today) {
        Object.keys(dailyAuraData[currentUser]).forEach(key => {
            if (key !== 'date') {
                dailyAuraData[currentUser][key] = 0;
            }
        });
        dailyAuraData[currentUser].date = today;
    }
    
    const incrementAmount = 25;
    const currentGivenToPerson = dailyAuraData[currentUser][person] || 0;
    const DAILY_POSITIVE_LIMIT = 500;
    const DAILY_NEGATIVE_LIMIT = -500;
    
    if (action === 'increment') {
        if (currentGivenToPerson + incrementAmount > DAILY_POSITIVE_LIMIT) {
            return res.status(400).json({ 
                error: `You've reached your daily limit of ${DAILY_POSITIVE_LIMIT} aura for ${person.charAt(0).toUpperCase() + person.slice(1)}!` 
            });
        }
        auraData[person] += incrementAmount;
        dailyAuraData[currentUser][person] = currentGivenToPerson + incrementAmount;
    } else if (action === 'decrement') {
        if (currentGivenToPerson - incrementAmount < DAILY_NEGATIVE_LIMIT) {
            return res.status(400).json({ 
                error: `You've reached your daily negative limit of ${DAILY_NEGATIVE_LIMIT} aura for ${person.charAt(0).toUpperCase() + person.slice(1)}!` 
            });
        }
        auraData[person] -= incrementAmount;
        dailyAuraData[currentUser][person] = currentGivenToPerson - incrementAmount;
    }
    
    // Coin earning/losing logic
    if (action === 'increment') {
        // Person receiving +1 aura gets 2 coins
        coinData[person] = (coinData[person] || 0) + 2;
        console.log(`${person} earned 2 coins for receiving +1 aura. New balance: ${coinData[person]}`);
    } else if (action === 'decrement') {
        // Person receiving -1 aura loses 1 coin (but never goes below 0)
        coinData[person] = Math.max(0, (coinData[person] || 0) - 1);
        console.log(`${person} lost 1 coin for receiving -1 aura. New balance: ${coinData[person]}`);
        
        // Person removing aura also loses 1 coin as penalty (but never goes below 0)
        coinData[currentUser] = Math.max(0, (coinData[currentUser] || 0) - 1);
        console.log(`${currentUser} lost 1 coin penalty for removing aura. New balance: ${coinData[currentUser]}`);
    }
    
    console.log('Final coin data being returned:', coinData);
    saveAuraData();
    res.json({ success: true, auraData, coinData });
});

// Admin API endpoints
app.post('/api/aura/admin', (req, res) => {
    const { userId, auraValue, adminUser } = req.body;
    
    // Verify admin access
    if (adminUser !== 'max') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Validate user exists
    if (!auraData.hasOwnProperty(userId)) {
        return res.status(400).json({ error: 'User not found' });
    }
    
    // Set aura value (no limits for admin)
    auraData[userId] = auraValue;
    
    console.log(`Admin ${adminUser} set ${userId} aura to ${auraValue}`);
    res.json({ success: true, auraData });
});

app.post('/api/aura/admin/reset', (req, res) => {
    const { adminUser } = req.body;
    
    // Verify admin access
    if (adminUser !== 'max') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Reset all aura to 0
    Object.keys(auraData).forEach(userId => {
        auraData[userId] = 0;
    });
    
    // Reset daily limits as well
    Object.keys(dailyAuraData).forEach(userId => {
        Object.keys(dailyAuraData[userId]).forEach(key => {
            if (key !== 'date') {
                dailyAuraData[userId][key] = 0;
            }
        });
    });
    
    // Save data after changes
    saveAuraData();
    
    console.log(`Admin ${adminUser} reset all aura to 0`);
    res.json({ success: true, auraData, dailyAuraData });
});

// Admin API endpoint to set individual user coins
app.post('/api/coins/admin', (req, res) => {
    const { userId, coinValue, adminUser } = req.body;
    
    // Verify admin access
    if (adminUser !== 'max') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Validate user exists
    if (!coinData.hasOwnProperty(userId)) {
        return res.status(400).json({ error: 'User not found' });
    }
    
    // Set coin value (no limits for admin)
    const oldCoins = coinData[userId];
    coinData[userId] = coinValue;
    
    console.log(`Admin ${adminUser} set ${userId} coins from ${oldCoins} to ${coinValue}`);
    
    // Save data after changes
    saveAuraData();
    
    res.json({ success: true, coinData });
});

// Admin API endpoint to update user passwords
app.post('/api/passwords/admin', (req, res) => {
    const { userId, newPassword, adminUser } = req.body;
    
    // Verify admin access
    if (adminUser !== 'max') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Validate user exists
    if (!passwordData.hasOwnProperty(userId)) {
        return res.status(400).json({ error: 'User not found' });
    }
    
    // Validate password is not empty
    if (!newPassword || newPassword.trim() === '') {
        return res.status(400).json({ error: 'Password cannot be empty' });
    }
    
    // Update password
    const oldPassword = passwordData[userId];
    passwordData[userId] = newPassword.trim();
    
    console.log(`Admin ${adminUser} updated password for ${userId}`);
    
    // Save password data
    savePasswordData();
    
    res.json({ 
        success: true, 
        message: `Password updated for ${userId}`,
        userId: userId
    });
});

// Purchase API endpoint for backgrounds
app.post('/api/coins/purchase', (req, res) => {
    const { userId, cost, item } = req.body;
    
    console.log(`Purchase request: ${userId} wants to buy ${item} for ${cost} coins`);
    
    // Validate user exists
    if (!coinData.hasOwnProperty(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user' });
    }
    
    // Check if user has enough coins
    if (coinData[userId] < cost) {
        return res.status(400).json({ success: false, message: 'Insufficient coins' });
    }
    
    // Process the purchase
    const oldCoins = coinData[userId];
    coinData[userId] -= cost;
    
    console.log(`User ${userId} purchased ${item} for ${cost} coins. Balance: ${oldCoins} -> ${coinData[userId]}`);
    
    // Add to purchased backgrounds if it's a background item
    if (item.startsWith('gradient')) {
        if (!purchasedBackgrounds[userId]) {
            purchasedBackgrounds[userId] = [];
        }
        if (!purchasedBackgrounds[userId].includes(item)) {
            purchasedBackgrounds[userId].push(item);
            savePurchasedBackgrounds(purchasedBackgrounds);
        }
    }
    
    // Save data after changes
    saveAuraData();
    
    res.json({ 
        success: true, 
        message: `Purchased ${item} for ${cost} coins`,
        newBalance: coinData[userId],
        coinData: coinData,
        purchasedBackgrounds: purchasedBackgrounds
    });
});

// Get purchased backgrounds for a user
app.get('/api/purchased-backgrounds/:userId', (req, res) => {
    const { userId } = req.params;
    
    if (!purchasedBackgrounds.hasOwnProperty(userId)) {
        return res.json({ success: true, backgrounds: [] });
    }
    
    res.json({ 
        success: true, 
        backgrounds: purchasedBackgrounds[userId] || []
    });
});

// Sync purchased backgrounds for a user
app.post('/api/purchased-backgrounds/:userId/sync', (req, res) => {
    const { userId } = req.params;
    const { backgrounds } = req.body;
    
    console.log(`Sync request: ${userId} syncing ${backgrounds ? backgrounds.length : 0} backgrounds`);
    
    if (!purchasedBackgrounds.hasOwnProperty(userId)) {
        purchasedBackgrounds[userId] = [];
    }
    
    // Merge server and client backgrounds (union of both)
    const serverBackgrounds = purchasedBackgrounds[userId] || [];
    const clientBackgrounds = backgrounds || [];
    const mergedBackgrounds = [...new Set([...serverBackgrounds, ...clientBackgrounds])];
    
    purchasedBackgrounds[userId] = mergedBackgrounds;
    savePurchasedBackgrounds(purchasedBackgrounds);
    
    res.json({ 
        success: true, 
        message: `Synced ${mergedBackgrounds.length} backgrounds for ${userId}`,
        backgrounds: mergedBackgrounds
    });
});

// Get all available badges
app.get('/api/badges', (req, res) => {
    res.json({ 
        success: true, 
        badges: ALL_BADGES 
    });
});

// Get purchased badges for a user
app.get('/api/purchased-badges/:userId', (req, res) => {
    const { userId } = req.params;
    
    if (!purchasedBadges.hasOwnProperty(userId)) {
        return res.json({ success: true, badges: [] });
    }
    
    res.json({ 
        success: true, 
        badges: purchasedBadges[userId] || []
    });
});

// Get equipped badge for a user
app.get('/api/equipped-badge/:userId', (req, res) => {
    const { userId } = req.params;
    
    res.json({ 
        success: true, 
        badge: equippedBadges[userId] || null
    });
});

// Sync purchased badges for a user
app.post('/api/purchased-badges/:userId/sync', (req, res) => {
    const { userId } = req.params;
    const { badges } = req.body;
    
    console.log(`Sync request: ${userId} syncing ${badges ? badges.length : 0} badges`);
    
    if (!purchasedBadges.hasOwnProperty(userId)) {
        purchasedBadges[userId] = [];
    }
    
    // Merge server and client badges (union of both)
    const serverBadges = purchasedBadges[userId] || [];
    const clientBadges = badges || [];
    const mergedBadges = [...new Set([...serverBadges, ...clientBadges])];
    
    purchasedBadges[userId] = mergedBadges;
    savePurchasedBadges(purchasedBadges);
    
    res.json({ 
        success: true, 
        message: `Synced ${mergedBadges.length} badges for ${userId}`,
        badges: mergedBadges
    });
});

// Purchase a badge
app.post('/api/badges/purchase', (req, res) => {
    const { userId, cost, badge } = req.body;
    
    console.log(`Badge purchase request: ${userId} wants to buy ${badge} for ${cost} coins`);
    
    // Validate user exists
    if (!coinData.hasOwnProperty(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user' });
    }
    
    // Check if user has enough coins
    if (coinData[userId] < cost) {
        return res.status(400).json({ success: false, message: 'Insufficient coins' });
    }
    
    // Check if badge exists
    if (!ALL_BADGES.includes(badge)) {
        return res.status(400).json({ success: false, message: 'Invalid badge' });
    }
    
    // Check if user already owns this badge
    if (purchasedBadges[userId] && purchasedBadges[userId].includes(badge)) {
        return res.status(400).json({ success: false, message: 'Badge already owned' });
    }
    
    // Process the purchase
    const oldCoins = coinData[userId];
    coinData[userId] -= cost;
    
    // Add to purchased badges
    if (!purchasedBadges[userId]) {
        purchasedBadges[userId] = [];
    }
    purchasedBadges[userId].push(badge);
    
    console.log(`User ${userId} purchased badge ${badge} for ${cost} coins. Balance: ${oldCoins} -> ${coinData[userId]}`);
    
    // Save data after changes
    saveAuraData();
    savePurchasedBadges(purchasedBadges);
    
    res.json({ 
        success: true, 
        message: `Purchased ${badge} for ${cost} coins`,
        newBalance: coinData[userId],
        coinData: coinData,
        purchasedBadges: purchasedBadges
    });
});

// Equip a badge
app.post('/api/badges/equip', (req, res) => {
    const { userId, badge } = req.body;
    
    console.log(`Equip request: ${userId} wants to equip ${badge}`);
    
    // Validate user exists
    if (!purchasedBadges.hasOwnProperty(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user' });
    }
    
    // Check if user owns this badge
    if (!purchasedBadges[userId] || !purchasedBadges[userId].includes(badge)) {
        return res.status(400).json({ success: false, message: 'Badge not owned' });
    }
    
    // Equip the badge
    equippedBadges[userId] = badge;
    saveEquippedBadges(equippedBadges);
    
    console.log(`User ${userId} equipped badge: ${badge}`);
    
    res.json({ 
        success: true, 
        message: `Equipped ${badge}`,
        equippedBadge: badge,
        equippedBadges: equippedBadges
    });
});

// Unequip a badge
app.post('/api/badges/unequip', (req, res) => {
    const { userId } = req.body;
    
    console.log(`Unequip request: ${userId} wants to unequip badge`);
    
    // Validate user exists
    if (!equippedBadges.hasOwnProperty(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user' });
    }
    
    // Unequip the badge
    const previousBadge = equippedBadges[userId];
    equippedBadges[userId] = null;
    saveEquippedBadges(equippedBadges);
    
    console.log(`User ${userId} unequipped badge: ${previousBadge}`);
    
    res.json({ 
        success: true, 
        message: `Unequipped badge`,
        equippedBadge: null,
        equippedBadges: equippedBadges
    });
});

// Admin API endpoint to reset all coins
app.post('/api/coins/admin/reset', (req, res) => {
    const { adminUser } = req.body;
    
    console.log(`Coin reset request received from admin: ${adminUser}`);
    
    // Verify admin access
    if (adminUser !== 'max') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Reset all coins to 0
    Object.keys(coinData).forEach(userId => {
        coinData[userId] = 0;
    });
    
    // Save data after changes
    saveAuraData();
    
    console.log(`Admin ${adminUser} reset all coins to 0`);
    res.json({ success: true, coinData });
});

// Test endpoint for daily reset
app.post('/api/test/daily-reset', (req, res) => {
    console.log(`[${new Date().toISOString()}] Manual daily reset test triggered`);
    
    // Store current state for comparison
    const beforeState = JSON.parse(JSON.stringify(dailyAuraData));
    
    // Force reset by setting yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toDateString();
    
    Object.keys(dailyAuraData).forEach(userId => {
        dailyAuraData[userId].date = yesterdayString;
        // Set some test data
        Object.keys(dailyAuraData[userId]).forEach(key => {
            if (key !== 'date') {
                dailyAuraData[userId][key] = Math.floor(Math.random() * 200) + 50; // Random test data
            }
        });
    });
    
    console.log('Before reset:', JSON.stringify(beforeState, null, 2));
    
    // Perform the reset
    performDailyReset();
    
    console.log('After reset:', JSON.stringify(dailyAuraData, null, 2));
    
    res.json({ 
        success: true, 
        message: 'Daily reset test completed',
        before: beforeState,
        after: dailyAuraData
    });
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Activity Log API endpoints
app.get('/api/activity-log', (req, res) => {
    try {
        res.json({
            success: true,
            activities: activityLog
        });
    } catch (error) {
        console.error('Error getting activity log:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get activity log'
        });
    }
});

app.post('/api/activity-log', (req, res) => {
    try {
        const { activity } = req.body;
        
        if (!activity) {
            return res.status(400).json({
                success: false,
                error: 'Activity data is required'
            });
        }
        
        // Add new activity to the beginning (newest first)
        activityLog.unshift(activity);
        
        // Keep only last 50 activities
        if (activityLog.length > 50) {
            activityLog = activityLog.slice(0, 50);
        }
        
        // Save to file
        saveActivityLog(activityLog);
        
        res.json({
            success: true,
            activities: activityLog
        });
    } catch (error) {
        console.error('Error saving activity log:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save activity log'
        });
    }
});

app.delete('/api/activity-log', (req, res) => {
    try {
        activityLog = [];
        saveActivityLog(activityLog);
        
        res.json({
            success: true,
            message: 'Activity log cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing activity log:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear activity log'
        });
    }
});

// Data Export/Import API endpoints
app.get('/api/export-data', (req, res) => {
    try {
        const exportData = {
            auraData: auraData,
            dailyAuraData: dailyAuraData,
            coinData: coinData,
            purchasedBackgrounds: purchasedBackgrounds,
            purchasedBadges: purchasedBadges,
            equippedBadges: equippedBadges,
            activityLog: activityLog,
            postsData: loadPostsData(),
            commentsData: loadCommentsData(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        res.json({
            success: true,
            data: exportData
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export data'
        });
    }
});

app.post('/api/import-data', (req, res) => {
    try {
        const { data } = req.body;
        
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Import data is required'
            });
        }
        
        // Validate required fields
        const requiredFields = ['auraData', 'dailyAuraData', 'coinData'];
        for (const field of requiredFields) {
            if (!data[field]) {
                return res.status(400).json({
                    success: false,
                    error: `Missing required field: ${field}`
                });
            }
        }
        
        // Import data with validation
        if (data.auraData) {
            saveAuraData(data.auraData);
            auraData = data.auraData;
        }
        
        if (data.dailyAuraData) {
            saveDailyAuraData(data.dailyAuraData);
            dailyAuraData = data.dailyAuraData;
        }
        
        if (data.coinData) {
            saveCoinData(data.coinData);
            coinData = data.coinData;
        }
        
        if (data.purchasedBackgrounds) {
            savePurchasedBackgrounds(data.purchasedBackgrounds);
            purchasedBackgrounds = data.purchasedBackgrounds;
        }
        
        if (data.purchasedBadges) {
            savePurchasedBadges(data.purchasedBadges);
            purchasedBadges = data.purchasedBadges;
        }
        
        if (data.equippedBadges) {
            saveEquippedBadges(data.equippedBadges);
            equippedBadges = data.equippedBadges;
        }
        
        if (data.activityLog) {
            saveActivityLog(data.activityLog);
            activityLog = data.activityLog;
        }
        
        if (data.postsData) {
            savePostsData(data.postsData);
        }
        
        if (data.commentsData) {
            saveCommentsData(data.commentsData);
        }
        
        res.json({
            success: true,
            message: 'Data imported successfully',
            importedFields: Object.keys(data)
        });
    } catch (error) {
        console.error('Error importing data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import data'
        });
    }
});

const PORT = process.env.PORT || 3067;
const HOST = '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
    console.log(`Aura OS Backend Server running on http://${HOST}:${PORT}`);
    console.log(`WebSocket server running on ws://${HOST}:${PORT}/ws`);
    console.log(`Access from other devices on your network using your computer's IP address`);
    console.log('WebSocket connections are reverse proxy compatible');
});
