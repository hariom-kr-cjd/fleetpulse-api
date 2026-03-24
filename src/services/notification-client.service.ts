import { config } from '../config/env';

interface NotificationPayload {
  userId: string;
  type: 'trip_assigned' | 'trip_completed' | 'maintenance_due' | 'general';
  title: string;
  message: string;
  tripId?: string;
}

export class NotificationClientService {
  async send(payload: NotificationPayload): Promise<void> {
    try {
      const response = await fetch(
        `${config.notificationServiceUrl}/api/v1/notifications/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Key': config.internalApiKey,
          },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        console.error(`Notification service returned ${response.status}`);
      }
    } catch (err) {
      // Fail silently — don't block trip operations
      console.error('Notification service unavailable:', (err as Error).message);
    }
  }
}
