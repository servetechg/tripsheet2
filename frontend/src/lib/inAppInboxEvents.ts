/** FCM foreground / other push paths can ask the header inbox to reload from API. */
export const IN_APP_INBOX_REFRESH_EVENT = 'tripsheet:in-app-refresh';

export function requestInAppInboxRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(IN_APP_INBOX_REFRESH_EVENT));
}
