export const shellKeys = {
  sidebar: (userId: string, role: string) => ["shell", "sidebar", userId, role] as const,
  unread: (userId: string) => ["shell", "unread", userId] as const,
};
