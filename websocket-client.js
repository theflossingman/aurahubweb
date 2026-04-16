// WebSocket Client for Aura OS
class AuraWebSocket {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.messageHandlers = new Map();
        
        // Auto-connect on initialization
        this.connect();
    }
    
    connect() {
        try {
            // Determine WebSocket URL based on current location
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/ws`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected successfully');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket connection closed');
                this.isConnected = false;
                this.emit('disconnected');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.attemptReconnect();
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
        }
    }
    
    handleMessage(message) {
        console.log('Received WebSocket message:', message);
        
        switch (message.type) {
            case 'initial_data':
                this.emit('initialData', message.data);
                break;
            case 'aura_updated':
                this.emit('auraUpdated', message.data);
                break;
            case 'aura_error':
                this.emit('auraError', message.error);
                break;
            case 'new_post':
                this.emit('newPost', message.data);
                break;
            case 'new_comment':
                this.emit('newComment', message.data);
                break;
            case 'purchase_completed':
                this.emit('purchaseCompleted', message.data);
                break;
            case 'purchase_error':
                this.emit('purchaseError', message.message);
                break;
            case 'error':
                this.emit('error', message.message);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }
    
    send(type, data) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            const message = { type, ...data };
            this.ws.send(JSON.stringify(message));
            return true;
        } else {
            console.warn('WebSocket not connected, message not sent:', { type, data });
            return false;
        }
    }
    
    // Convenience methods
    updateAura(person, action, currentUser) {
        return this.send('update_aura', { person, action, currentUser });
    }
    
    addPost(post) {
        return this.send('new_post', { post });
    }
    
    addComment(postId, comment) {
        return this.send('new_comment', { postId, comment });
    }
    
    makePurchase(userId, cost, item, itemType) {
        return this.send('purchase', { userId, cost, item, itemType });
    }
    
    // Event handling
    on(event, callback) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, new Set());
        }
        this.messageHandlers.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).delete(callback);
        }
    }
    
    emit(event, data) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in WebSocket event handler for '${event}':`, error);
                }
            });
        }
    }
    
    // Connection status
    isReady() {
        return this.isConnected && this.ws.readyState === WebSocket.OPEN;
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

// Global WebSocket instance
let auraWS = null;

// Initialize WebSocket when DOM is ready
function initializeWebSocket() {
    if (!auraWS) {
        auraWS = new AuraWebSocket();
        window.auraWS = auraWS; // Make it globally accessible
    }
    return auraWS;
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWebSocket);
} else {
    initializeWebSocket();
}
