export type NotificationLanguage = 'ar' | 'en' | 'fr';
type LocalizedMessage = { title?: unknown; body?: unknown };
export type NotificationRecord = {
  id?: unknown;
  to?: unknown;
  type?: unknown;
  title?: unknown;
  text?: unknown;
  messages?: Partial<Record<NotificationLanguage, LocalizedMessage>>;
  data?: Record<string, unknown>;
  t?: unknown;
  read?: boolean;
  severity?: unknown;
  occurrences?: unknown;
};

export function notificationCopy(note: NotificationRecord, language: NotificationLanguage) {
  const localized = note.messages?.[language];
  return {
    title: typeof localized?.title === 'string'
      ? localized.title
      : typeof note.title === 'string' ? note.title : '',
    body: typeof localized?.body === 'string'
      ? localized.body
      : typeof note.text === 'string' ? note.text : '',
  };
}
