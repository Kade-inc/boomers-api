import { Response } from 'express';

interface SSEClient {
    id: string;
    userId: string;
    response: Response;
}

class SSENotificationService {
    private clients: Map<string, SSEClient[]> = new Map();

    /**
     * Add a new SSE client connection for a user
     */
    addClient(userId: string, res: Response): string {
        const clientId = `${userId}_${Date.now()}`;

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // Flush headers immediately
        res.flushHeaders();

        // Send initial connection message
        res.write(`event: connected\ndata: ${JSON.stringify({ clientId, userId })}\n\n`);

        const client: SSEClient = {
            id: clientId,
            userId,
            response: res,
        };

        // Add client to the map
        const userClients = this.clients.get(userId) || [];
        userClients.push(client);
        this.clients.set(userId, userClients);

        console.log(`SSE client connected: ${clientId} for user ${userId}`);

        return clientId;
    }

    /**
     * Remove a client connection
     */
    removeClient(userId: string, clientId: string): void {
        const userClients = this.clients.get(userId);
        if (userClients) {
            const filteredClients = userClients.filter(client => client.id !== clientId);
            if (filteredClients.length === 0) {
                this.clients.delete(userId);
            } else {
                this.clients.set(userId, filteredClients);
            }
            console.log(`SSE client disconnected: ${clientId} for user ${userId}`);
        }
    }

    /**
     * Send a notification to a specific user
     */
    sendNotification(userId: string, notification: any): void {
        const userClients = this.clients.get(userId);
        if (userClients && userClients.length > 0) {
            const data = JSON.stringify(notification);
            userClients.forEach(client => {
                try {
                    client.response.write(`event: notification\ndata: ${data}\n\n`);
                } catch (error) {
                    console.error(`Error sending SSE to client ${client.id}:`, error);
                    // Remove the failed client
                    this.removeClient(userId, client.id);
                }
            });
            console.log(`Notification sent via SSE to user ${userId}`);
        } else {
            console.log(`No SSE clients connected for user ${userId}`);
        }
    }

    /**
     * Send a heartbeat to all connected clients to keep connections alive
     */
    sendHeartbeat(): void {
        this.clients.forEach((userClients, userId) => {
            userClients.forEach(client => {
                try {
                    client.response.write(`: heartbeat\n\n`);
                } catch (error) {
                    console.error(`Error sending heartbeat to client ${client.id}:`, error);
                    this.removeClient(userId, client.id);
                }
            });
        });
    }

    /**
     * Get the number of connected clients for a user
     */
    getClientCount(userId: string): number {
        return this.clients.get(userId)?.length || 0;
    }

    /**
     * Get total number of connected clients
     */
    getTotalClientCount(): number {
        let count = 0;
        this.clients.forEach(userClients => {
            count += userClients.length;
        });
        return count;
    }
}

// Export a singleton instance
export const sseNotificationService = new SSENotificationService();

// Start heartbeat interval (every 30 seconds)
setInterval(() => {
    sseNotificationService.sendHeartbeat();
}, 30000);

export default sseNotificationService;
