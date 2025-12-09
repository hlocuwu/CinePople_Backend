import { Timestamp } from 'firebase-admin/firestore';


export enum MembershipRank {
  STANDARD = 'Standard', 
  SILVER = 'Silver',    
  GOLD = 'Gold',         
  DIAMOND = 'Diamond'    
}

export interface UserDocument {
  email: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  role?: 'user' | 'admin'; 
  
  currentPoints: number;      
  totalSpending: number;      
  rank: MembershipRank;     
}

export interface User extends UserDocument {
  id: string;
}


export interface BookingHistoryItem {
  id: string;
  userId: string;
  showtimeId: string;
  movieTitle: string; 
  posterUrl: string; 
  cinemaName: string; 
  totalPrice: number;
  seats: string[];
  createdAt: Timestamp;
}