import { Request, Response, NextFunction } from "express";
import { firebaseAuth, firebaseDB } from "../config/firebase";
import { DecodedIdToken } from "firebase-admin/auth";

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided or invalid format (Bearer <token>)",
      });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    (req as AuthRequest).user = decodedToken;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decodedToken = await firebaseAuth.verifyIdToken(token);

      (req as AuthRequest).user = decodedToken;
    }

    next();
  } catch (error) {
    next();
  }
};

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      console.log("[Admin Check] Không tìm thấy user trong request");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    console.log("[Admin Check] Đang kiểm tra UID:", user.uid);

    const userDoc = await firebaseDB.collection('users').doc(user.uid).get();

    console.log("[Admin Check] Tìm thấy trong DB?", userDoc.exists);
    if (userDoc.exists) {
      console.log("[Admin Check] Data:", userDoc.data());
    } else {
      console.log("[Admin Check] Document không tồn tại với ID này!");
    }

    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      console.log("[Admin Check] Bị chặn! Role hiện tại:", userDoc.data()?.role);
      return res.status(403).json({ success: false, message: "Forbidden - Admin access required" });
    }

    console.log("[Admin Check] Hợp lệ! Cho qua.");
    next();
  } catch (error) {
    console.error("Check Admin Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};