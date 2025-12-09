import { firebaseDB } from "../../config/firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { MembershipRank, UserDocument } from "../user/model";

const usersCollection = firebaseDB.collection("users");

export class AuthService {
  async syncUser(decodedToken: DecodedIdToken) {
    const { uid, email, name, picture, phone_number } = decodedToken;
    
    const userRef = usersCollection.doc(uid);
    const doc = await userRef.get();
    const now = Timestamp.now();

    if (!doc.exists) {
      const newUser: UserDocument = {
        email: email || "",
        displayName: name || "New User",
        photoURL: picture || "",
        phone: phone_number || "",
        role: 'user',
        createdAt: now,
        updatedAt: now,
        
        currentPoints: 0,
        totalSpending: 0,
        rank: MembershipRank.STANDARD
      };

      await userRef.set(newUser);
      
      return { id: uid, ...newUser, isNewUser: true };
    }

    return { id: doc.id, ...doc.data(), isNewUser: false };
  }
}