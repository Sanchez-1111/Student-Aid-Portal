export type Role = 'student' | 'staff' | 'admin';

export interface User {
  id: number;
  schoolId: string;
  firstName: string;
  lastName: string;
  email: string;
  course: string;
  year: string;
  role: Role;
}

export interface Application {
  id: number;
  userId: number;
  type: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  category: string;
  date: string;
}

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  timestamp: string;
}

export interface Document {
  id: number;
  userId: number;
  type: string;
  filename: string;
  originalName: string;
  size: number;
  date: string;
}
