// Aura OS Main JavaScript
class AuraOS {
    constructor() {
        this.currentUser = null;
        this.ws = null;
        this.users = [
            { id: 'max', name: 'Max', status: 'online', avatar: 'M', gradient: 'avatar-1' },
            { id: 'gigi', name: 'Gigi', status: 'online', avatar: 'G', gradient: 'avatar-2' },
            { id: 'marco', name: 'Marco', status: 'online', avatar: 'M', gradient: 'avatar-3' },
            { id: 'dezi', name: 'Dezi', status: 'online', avatar: 'D', gradient: 'avatar-4' },
            { id: 'sevi', name: 'Sevi', status: 'online', avatar: 'S', gradient: 'avatar-5' }
        ];
        this.auraData = {};
        this.coinData = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createParticles();
        this.loadUserData();
        this.initializeAnimations();
        this.setupWebSocket();
    }

    setupWebSocket() {
        // Wait for WebSocket to be available
        const checkWebSocket = () => {
            if (window.auraWS && window.auraWS.isReady()) {
                this.ws = window.auraWS;
                this.setupWebSocketListeners();
                console.log('WebSocket connected to AuraOS');
            } else if (window.auraWS) {
                window.auraWS.on('connected', () => {
                    this.ws = window.auraWS;
                    this.setupWebSocketListeners();
                    console.log('WebSocket connected to AuraOS');
                });
            } else {
                setTimeout(checkWebSocket, 100);
            }
        };
        checkWebSocket();
    }

    setupWebSocketListeners() {
        if (!this.ws) return;

        this.ws.on('initialData', (data) => {
            this.auraData = data.auraData;
            this.coinData = data.coinData;
            this.updateAuraDisplay();
        });

        this.ws.on('auraUpdated', (data) => {
            this.auraData = data.auraData;
            this.coinData = data.coinData;
            this.updateAuraDisplay();
            this.showAuraUpdateNotification(data);
        });

        this.ws.on('auraError', (error) => {
            this.showNotification('Aura Error', error, 'error');
        });
    }

    updateAuraDisplay() {
        if (!this.auraData) return;
        
        // Update aura display for each user
        Object.keys(this.auraData).forEach(userId => {
            const userElement = document.querySelector(`[data-user-aura="${userId}"]`);
            if (userElement) {
                userElement.textContent = this.auraData[userId];
            }
        });

        // Update coin display
        if (this.currentUser && this.coinData) {
            const coinElement = document.querySelector('.user-coins');
            if (coinElement) {
                coinElement.textContent = this.coinData[this.currentUser.id] || 0;
            }
        }
    }

    showAuraUpdateNotification(data) {
        const actionText = data.action === 'increment' ? 'gave' : 'removed';
        const amountText = data.amount > 0 ? `+${data.amount}` : `${data.amount}`;
        this.showNotification(
            'Aura Updated!',
            `${data.currentUser} ${actionText} ${amountText} aura to ${data.person}`,
            'info'
        );
    }

    setupEventListeners() {
        // User card clicks
        document.querySelectorAll('.user-card[data-user]').forEach(card => {
            card.addEventListener('click', (e) => this.handleUserLogin(e));
        });


        // Action cards
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => this.handleActionClick(e));
        });

        // Ripple effect on clickable elements
        document.addEventListener('click', (e) => this.createRipple(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    handleUserLogin(e) {
        const userCard = e.currentTarget;
        const userId = userCard.dataset.user;
        const user = this.users.find(u => u.id === userId);
        
        if (user) {
            this.loginUser(user);
        }
    }

    loginUser(user) {
        // Add loading animation
        const userCard = document.querySelector(`[data-user="${user.id}"]`);
        userCard.classList.add('loading');
        
        // Simulate login process
        setTimeout(() => {
            this.currentUser = user;
            this.saveUserData();
            this.switchToDashboard();
            userCard.classList.remove('loading');
        }, 800);
    }

    switchToDashboard() {
        const loginScreen = document.getElementById('loginScreen');
        const dashboardScreen = document.getElementById('dashboardScreen');
        
        // Update user info in dashboard
        this.updateDashboardUser();
        
        // Screen transition
        loginScreen.classList.add('hidden');
        setTimeout(() => {
            dashboardScreen.classList.remove('hidden');
            this.initializeDashboardAnimations();
        }, 300);
    }

    updateDashboardUser() {
        if (!this.currentUser) return;
        
        const userAvatar = document.querySelector('.user-avatar-small .avatar-gradient');
        const userInitial = document.querySelector('.user-initial-small');
        const userName = document.querySelector('.current-user');
        
        if (userAvatar) {
            userAvatar.className = `avatar-gradient ${this.currentUser.gradient}`;
        }
        if (userInitial) {
            userInitial.textContent = this.currentUser.avatar;
        }
        if (userName) {
            userName.textContent = this.currentUser.name;
        }
    }

    initializeDashboardAnimations() {
        // Animate dashboard elements
        const elements = document.querySelectorAll('.quick-actions, .family-activity, .action-card, .activity-item');
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    handleActionClick(e) {
        const card = e.currentTarget;
        const action = card.querySelector('h4').textContent.toLowerCase();
        
        // Add ripple effect
        this.createRipple(e);
        
        // Handle different actions
        switch(action) {
            case 'messages':
                this.openMessages();
                break;
            case 'calendar':
                this.openCalendar();
                break;
            case 'photos':
                this.openPhotos();
                break;
            case 'notes':
                this.openNotes();
                break;
        }
    }

    openMessages() {
        this.showNotification('Messages', 'Opening messages...', 'info');
    }

    openCalendar() {
        this.showNotification('Calendar', 'Opening calendar...', 'info');
    }

    openPhotos() {
        this.showNotification('Photos', 'Opening photo gallery...', 'info');
    }

    openNotes() {
        this.showNotification('Notes', 'Opening notes...', 'info');
    }


    updateAura(person, action) {
        if (!this.currentUser || !this.ws) {
            this.showNotification('Error', 'Not connected to server', 'error');
            return;
        }

        const success = this.ws.updateAura(person, action, this.currentUser.id);
        if (!success) {
            this.showNotification('Error', 'Failed to send update', 'error');
        }
    }

    renderUserCard(user) {
        const usersGrid = document.querySelector('.users-grid');
        
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.dataset.user = user.id;
        userCard.innerHTML = `
            <div class="user-avatar">
                <div class="avatar-gradient ${user.gradient}"></div>
                <span class="user-initial">${user.avatar}</span>
            </div>
            <h3 class="user-name">${user.name}</h3>
            <p class="user-status">${user.status}</p>
        `;
        
        usersGrid.appendChild(userCard);
        
        // Add event listener
        userCard.addEventListener('click', (e) => this.handleUserLogin(e));
        
        // Animate in
        setTimeout(() => {
            userCard.style.opacity = '0';
            userCard.style.transform = 'scale(0.8)';
            userCard.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            setTimeout(() => {
                userCard.style.opacity = '1';
                userCard.style.transform = 'scale(1)';
            }, 50);
        }, 100);
    }

    createRipple(e) {
        const card = e.currentTarget;
        if (!card) return;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        
        const rect = card.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        card.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    createParticles() {
        const background = document.querySelector('.background');
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'liquid-particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 10 + 's';
            particle.style.animationDuration = (10 + Math.random() * 10) + 's';
            background.appendChild(particle);
        }
    }

    initializeAnimations() {
        // Add liquid animations to elements
        document.querySelectorAll('.user-card, .action-card').forEach(card => {
            card.classList.add('liquid-card');
        });
        
        // Add floating animations
        document.querySelectorAll('.orb').forEach((orb, index) => {
            orb.classList.add(`floating-delay-${index + 1}`);
        });
    }

    handleKeyboard(e) {
        // ESC to logout
        if (e.key === 'Escape' && this.currentUser) {
            logout();
        }
        
        // Number keys for quick user selection
        if (!this.currentUser && e.key >= '1' && e.key <= '9') {
            const userIndex = parseInt(e.key) - 1;
            const userCards = document.querySelectorAll('.user-card[data-user]');
            if (userCards[userIndex]) {
                userCards[userIndex].click();
            }
        }
    }

    showNotification(title, message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
            <button class="notification-close">×</button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 100);
        
        // Auto remove
        setTimeout(() => {
            this.removeNotification(notification);
        }, 3000);
        
        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.removeNotification(notification);
        });
    }

    removeNotification(notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }

    saveUserData() {
        if (this.currentUser) {
            localStorage.setItem('auraOS_currentUser', JSON.stringify(this.currentUser));
        }
    }

    loadUserData() {
        const savedUser = localStorage.getItem('auraOS_currentUser');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                this.switchToDashboard();
            } catch (e) {
                console.error('Error loading user data:', e);
            }
        }
    }
}

// Global logout function
function logout() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    // Clear current user
    auraOS.currentUser = null;
    localStorage.removeItem('auraOS_currentUser');
    
    // Screen transition
    dashboardScreen.classList.add('hidden');
    setTimeout(() => {
        loginScreen.classList.remove('hidden');
    }, 300);
}

// Aura Flow functionality
class AuraFlow {
    constructor() {
        this.currentView = 'feed';
        this.posts = [];
        this.shorts = [];
        this.currentUser = null;
        this.ws = null;
        this.init();
    }

    init() {
        this.loadContent();
        this.setupEventListeners();
        this.setupWebSocket();
    }

    setupWebSocket() {
        // Wait for WebSocket to be available
        const checkWebSocket = () => {
            if (window.auraWS && window.auraWS.isReady()) {
                this.ws = window.auraWS;
                this.setupWebSocketListeners();
                console.log('WebSocket connected to AuraFlow');
            } else if (window.auraWS) {
                window.auraWS.on('connected', () => {
                    this.ws = window.auraWS;
                    this.setupWebSocketListeners();
                    console.log('WebSocket connected to AuraFlow');
                });
            } else {
                setTimeout(checkWebSocket, 100);
            }
        };
        checkWebSocket();
    }

    setupWebSocketListeners() {
        if (!this.ws) return;

        this.ws.on('initialData', (data) => {
            this.posts = data.posts || [];
            this.renderFeed();
        });

        this.ws.on('newPost', (data) => {
            this.posts.unshift(data.post);
            this.renderFeed();
            this.showNewPostNotification(data.post);
        });

        this.ws.on('newComment', (data) => {
            this.updatePostComments(data.postId, data.comment, data.totalComments);
            this.showNewCommentNotification(data.comment);
        });
    }

    showNewPostNotification(post) {
        this.showNotification(
            'New Post!',
            `${post.user} just posted something new`,
            'success'
        );
    }

    showNewCommentNotification(comment) {
        this.showNotification(
            'New Comment!',
            `${comment.user} commented on a post`,
            'info'
        );
    }

    updatePostComments(postId, newComment, totalComments) {
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            const commentButton = postElement.querySelector('.post-action-btn:nth-child(2) span:last-child');
            if (commentButton) {
                commentButton.textContent = totalComments;
            }
        }
    }

    setupEventListeners() {
        // View switching
        document.getElementById('feedBtn')?.addEventListener('click', () => this.switchView('feed'));
        document.getElementById('shortsBtn')?.addEventListener('click', () => this.switchView('shorts'));
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}Btn`).classList.add('active');

        // Update views
        document.querySelectorAll('.flow-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');

        this.currentView = view;
    }

    loadContent() {
        // Load posts and shorts from server via WebSocket
        // If WebSocket is not ready, load from localStorage as fallback
        if (this.ws && this.ws.isReady()) {
            // Data will be loaded via WebSocket initial_data event
            console.log('Loading content via WebSocket...');
        } else {
            // Fallback to localStorage
            const savedPosts = localStorage.getItem('auraFlow_posts');
            const savedShorts = localStorage.getItem('auraFlow_shorts');
            
            this.posts = savedPosts ? JSON.parse(savedPosts) : this.generateSamplePosts();
            this.shorts = savedShorts ? JSON.parse(savedShorts) : [];
            
            this.renderFeed();
            this.renderShorts();
        }
    }

    generateSamplePosts() {
        return [
            {
                id: 1,
                user: 'Max',
                avatar: 'M',
                gradient: 'avatar-1',
                time: '2 hours ago',
                text: 'Welcome to Aura Flow! This is our new family social hub where we can share posts and videos with each other. 🌊',
                likes: 5,
                comments: 2,
                liked: false
            },
            {
                id: 2,
                user: 'Gigi',
                avatar: 'G',
                gradient: 'avatar-2',
                time: '4 hours ago',
                text: 'Had an amazing day today! Who else loves the weekend? 😊',
                likes: 8,
                comments: 3,
                liked: false
            },
            {
                id: 3,
                user: 'Marco',
                avatar: 'M',
                gradient: 'avatar-3',
                time: '6 hours ago',
                text: 'Check out this beautiful sunset I captured!',
                image: 'https://picsum.photos/seed/sunset/400/300.jpg',
                likes: 12,
                comments: 4,
                liked: false
            }
        ];
    }

    renderFeed() {
        const feedContainer = document.getElementById('feedContainer');
        if (!feedContainer) return;

        if (this.posts.length === 0) {
            feedContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <h4>No posts yet</h4>
                    <p>Be the first to share something!</p>
                </div>
            `;
            return;
        }

        feedContainer.innerHTML = this.posts.map(post => this.createPostHTML(post)).join('');
        this.attachPostEventListeners();
    }

    createPostHTML(post) {
        let contentHTML = '';
        
        if (post.type === 'text') {
            contentHTML = `<div class="post-text">${post.text}</div>`;
        } else if (post.type === 'image') {
            contentHTML = `
                <div class="post-text">${post.text}</div>
                <img src="${post.image}" alt="Post image" class="post-image" onclick="openImageModal('${post.image}')">
            `;
        } else if (post.type === 'poll') {
            contentHTML = `
                <div class="post-text">${post.poll.question}</div>
                ${this.createPollHTML(post.poll)}
            `;
        } else {
            // Fallback for old format
            contentHTML = `
                <div class="post-text">${post.text}</div>
                ${post.image ? `<img src="${post.image}" alt="Post image" class="post-image" onclick="openImageModal('${post.image}')">` : ''}
                ${post.poll ? this.createPollHTML(post.poll) : ''}
            `;
        }
        
        return `
            <div class="post-card" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-avatar ${post.gradient}">
                        <span>${post.avatar}</span>
                    </div>
                    <div class="post-user-info">
                        <div class="post-username">${post.user}</div>
                        <div class="post-time">${post.time}</div>
                    </div>
                </div>
                <div class="post-content">
                    ${contentHTML}
                </div>
                <div class="post-actions">
                    <button class="post-action-btn ${post.liked ? 'liked' : ''}" onclick="auraFlow.toggleLike(${post.id})">
                        <span>${post.liked ? '❤️' : '🤍'}</span>
                        <span>${post.likes}</span>
                    </button>
                    <button class="post-action-btn" onclick="auraFlow.openComments(${post.id})">
                        <span>💬</span>
                        <span>${post.comments}</span>
                    </button>
                    <button class="post-action-btn" onclick="auraFlow.sharePost(${post.id})">
                        <span>📤</span>
                        <span>Share</span>
                    </button>
                </div>
            </div>
        `;
    }

    createPollHTML(poll) {
        const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
        
        return `
            <div class="post-poll">
                <div class="poll-question">${poll.question}</div>
                ${poll.options.map(option => `
                    <div class="poll-option ${option.selected ? 'selected' : ''}" onclick="auraFlow.votePoll(${poll.id}, '${option.text}')">
                        <div class="poll-bar" style="width: ${totalVotes > 0 ? (option.votes / totalVotes * 100) : 0}%"></div>
                        <div class="poll-text">${option.text}</div>
                        ${totalVotes > 0 ? `<div class="poll-percentage">${Math.round(option.votes / totalVotes * 100)}%</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderShorts() {
        const shortsContainer = document.getElementById('shortsContainer');
        if (!shortsContainer) return;

        if (this.shorts.length === 0) {
            shortsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎥</div>
                    <h4>No shorts yet</h4>
                    <p>Record your first short video!</p>
                </div>
            `;
            return;
        }

        shortsContainer.innerHTML = this.shorts.map(short => this.createShortHTML(short)).join('');
    }

    createShortHTML(short) {
        return `
            <div class="short-item">
                <video class="short-video" src="${short.url}" loop muted></video>
                <div class="short-overlay">
                    <div class="short-info">
                        <div class="short-username">${short.user}</div>
                        <div class="short-caption">${short.caption}</div>
                    </div>
                    <div class="short-actions">
                        <button class="short-action-btn ${short.liked ? 'liked' : ''}" onclick="auraFlow.toggleShortLike(${short.id})">
                            <span>${short.liked ? '❤️' : '🤍'}</span>
                        </button>
                        <button class="short-action-btn" onclick="auraFlow.openShortComments(${short.id})">
                            <span>💬</span>
                        </button>
                        <button class="short-action-btn" onclick="auraFlow.shareShort(${short.id})">
                            <span>📤</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    addPost(postData) {
        if (!this.ws || !this.ws.isReady()) {
            this.showNotification('Error', 'Not connected to server', 'error');
            return;
        }

        const post = {
            ...postData,
            id: Date.now(),
            user: auraOS.currentUser ? auraOS.currentUser.name : 'Anonymous',
            avatar: auraOS.currentUser ? auraOS.currentUser.avatar : 'A',
            gradient: auraOS.currentUser ? auraOS.currentUser.gradient : 'avatar-1',
            time: 'Just now',
            timestamp: new Date().toISOString(),
            likes: 0,
            comments: 0,
            liked: false
        };

        const success = this.ws.addPost(post);
        if (!success) {
            this.showNotification('Error', 'Failed to create post', 'error');
        }
    }

    addComment(postId, commentText) {
        if (!this.ws || !this.ws.isReady()) {
            this.showNotification('Error', 'Not connected to server', 'error');
            return;
        }

        const comment = {
            text: commentText,
            user: auraOS.currentUser ? auraOS.currentUser.name : 'Anonymous',
            avatar: auraOS.currentUser ? auraOS.currentUser.avatar : 'A',
            gradient: auraOS.currentUser ? auraOS.currentUser.gradient : 'avatar-1'
        };

        const success = this.ws.addComment(postId, comment);
        if (!success) {
            this.showNotification('Error', 'Failed to add comment', 'error');
        }
    }

    votePoll(pollId, optionText) {
        // Handle poll voting
        console.log('Voted on poll:', pollId, optionText);
    }

    openComments(postId) {
        console.log('Opening comments for post:', postId);
    }

    openShortComments(shortId) {
        console.log('Opening comments for short:', shortId);
    }

    sharePost(postId) {
        console.log('Sharing post:', postId);
    }

    shareShort(shortId) {
        console.log('Sharing short:', shortId);
    }

    saveContent() {
        localStorage.setItem('auraFlow_posts', JSON.stringify(this.posts));
        localStorage.setItem('auraFlow_shorts', JSON.stringify(this.shorts));
    }

    attachPostEventListeners() {
        // Add any additional event listeners for posts
    }

    refreshFeed() {
        this.loadContent();
        this.showNotification('Feed refreshed!', 'success');
    }

    showNotification(message, type = 'info') {
        // Show notification to user
        console.log('Notification:', message, type);
    }
}

// Global Aura Flow instance
let auraFlow;

// Initialize Aura Flow when app opens
function openAuraFlow() {
    const auraFlowScreen = document.getElementById('auraFlowScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    // Hide dashboard, show Aura Flow
    dashboardScreen.classList.add('hidden');
    auraFlowScreen.classList.remove('hidden');
    
    // Initialize Aura Flow if not already done
    if (!auraFlow) {
        auraFlow = new AuraFlow();
    }
    
    // Update user info in header
    if (auraOS && auraOS.currentUser) {
        const userInitial = document.getElementById('flowUserInitial');
        const currentUserName = document.getElementById('flowCurrentUser');
        if (userInitial) userInitial.textContent = auraOS.currentUser.name.charAt(0);
        if (currentUserName) currentUserName.textContent = auraOS.currentUser.name;
    }
}

// Close Aura Flow app
function closeAuraFlow() {
    const auraFlowScreen = document.getElementById('auraFlowScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    auraFlowScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
}

// Switch between feed and shorts views
function switchFlowView(view) {
    if (auraFlow) {
        auraFlow.switchView(view);
    }
}

// Open create content modal
function openCreateModal() {
    const modal = document.getElementById('createModal');
    modal.classList.remove('hidden');
}

// Close create content modal
function closeCreateModal() {
    const modal = document.getElementById('createModal');
    modal.classList.add('hidden');
}

// Create post
function createPost() {
    closeCreateModal();
    console.log('Opening post creation...');
    // TODO: Implement post creation interface
}

// Create short
function createShort() {
    closeCreateModal();
    console.log('Opening short recording...');
    // TODO: Implement short recording interface
}

// Refresh feed
function refreshFeed() {
    if (auraFlow) {
        auraFlow.refreshFeed();
    }
}

// Initialize Aura OS
const auraOS = new AuraOS();

// Add notification styles
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        padding: 1rem;
        min-width: 300px;
        z-index: 1000;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .notification-content h4 {
        margin-bottom: 0.5rem;
        font-size: 1rem;
        font-weight: 600;
    }
    
    .notification-content p {
        font-size: 0.9rem;
        color: var(--text-secondary);
        margin: 0;
    }
    
    .notification-close {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0.25rem;
    }
    
    .notification-close:hover {
        color: var(--text-primary);
    }
    
    .notification-success {
        border-color: rgba(34, 197, 94, 0.3);
        background: rgba(34, 197, 94, 0.1);
    }
    
    .notification-info {
        border-color: rgba(59, 130, 246, 0.3);
        background: rgba(59, 130, 246, 0.1);
    }
    
    .loading {
        opacity: 0.7;
        pointer-events: none;
        transform: scale(0.95);
    }
`;

// Add styles to page
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);
