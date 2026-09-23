export interface InAppNotification {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  body: string;
  link?: string | null;
  type: string;
  readAt?: string | null;
  createdAt: string;
}

export interface InAppNotificationListResponse {
  items: InAppNotification[];
  unreadCount: number;
}

/** Socket.IO event payload (server → client). */
export interface InAppNotificationEvent {
  notification: InAppNotification;
  unreadCount: number;
}

export const IN_APP_SOCKET_NAMESPACE = '/in-app';
export const IN_APP_SOCKET_EVENT = 'in-app:notification';
