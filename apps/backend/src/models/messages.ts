export interface IncomingMessage {
  author: string;
  authorId?: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
  threadId: string;
  threadName?: string;
  threadParentId?: string;
  threadParentName?: string;
  isSupportAgent?: boolean;
}

export interface StoredMessage {
  id: number;
  author: string;
  authorId?: string | null;
  avatarUrl?: string | null;
  content: string;
  createdAt: string;
  threadId: string;
  threadName?: string | null;
  threadParentId?: string | null;
  threadParentName?: string | null;
  isSupportAgent: boolean;
}

export interface ThreadSummary {
  id: string;
  name: string;
  lastMessageAt: string | null;
  messageCount: number;
  parentId: string | null;
  parentName: string | null;
  ownerName: string | null;
  ownerId: string | null;
  lastMessageFromAgent: boolean;
  pendingCustomerMessages: number;
  lastAgentMessageAt: string | null;
}
