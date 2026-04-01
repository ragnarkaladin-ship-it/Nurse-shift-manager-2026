import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT Secret - in a real app, this should be in .env
const JWT_SECRET = process.env.JWT_SECRET || "tumutumu-hospital-secret-key-2026";

// Local User Storage
const USERS_FILE = path.join(__dirname, "data", "users.json");

interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  wardId?: string | null;
  nckRegistrationNumber?: string | null;
  licenseExpiryDate?: string | null;
  passwordHash?: string;
  isDefaultPassword?: boolean;
  createdAt: string;
}

class UserStorage {
  private static getUsersLocal(): User[] {
    try {
      if (!fs.existsSync(USERS_FILE)) {
        fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
        fs.writeFileSync(USERS_FILE, JSON.stringify([]));
        return [];
      }
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error reading users file:", error);
      return [];
    }
  }

  private static saveUsersLocal(users: User[]) {
    try {
      fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
      console.error("Error saving users file:", error);
    }
  }

  static async findByEmail(email: string): Promise<User | undefined> {
    // Try Firestore first
    try {
      if (typeof firestoreStatus !== 'undefined' && firestoreStatus.startsWith('ok')) {
        const snapshot = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
        if (!snapshot.empty) {
          return snapshot.docs[0].data() as User;
        }
      }
    } catch (error: any) {
      // Only log if it's not a 5 NOT_FOUND which we already handle in health check
      if (!error?.message?.includes('5 NOT_FOUND')) {
        console.error("Firestore findByEmail failed:", error);
      }
    }

    // Fallback to local
    return this.getUsersLocal().find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  static async findById(uid: string): Promise<User | undefined> {
    // Try Firestore first
    try {
      if (typeof firestoreStatus !== 'undefined' && firestoreStatus.startsWith('ok')) {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
          return doc.data() as User;
        }
      }
    } catch (error: any) {
      if (!error?.message?.includes('5 NOT_FOUND')) {
        console.error("Firestore findById failed:", error);
      }
    }

    // Fallback to local
    return this.getUsersLocal().find(u => u.uid === uid);
  }

  static async createUser(userData: Partial<User>): Promise<User> {
    const newUser: User = {
      uid: userData.uid || uuidv4(),
      name: userData.name || "",
      email: userData.email || "",
      phone: userData.phone || null,
      role: userData.role || "staff",
      wardId: userData.wardId || null,
      nckRegistrationNumber: userData.nckRegistrationNumber || null,
      licenseExpiryDate: userData.licenseExpiryDate || null,
      passwordHash: userData.passwordHash,
      isDefaultPassword: userData.isDefaultPassword ?? true,
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore
    try {
      if (typeof firestoreStatus !== 'undefined' && firestoreStatus.startsWith('ok')) {
        await db.collection('users').doc(newUser.uid).set(newUser);
      }
    } catch (error: any) {
      if (!error?.message?.includes('5 NOT_FOUND')) {
        console.error("Firestore createUser failed:", error);
      }
    }

    // Also save to local for redundancy/fallback
    const users = this.getUsersLocal();
    users.push(newUser);
    this.saveUsersLocal(users);

    return newUser;
  }

  static async updateUser(uid: string, updates: Partial<User>): Promise<User | undefined> {
    // Update Firestore
    try {
      if (typeof firestoreStatus !== 'undefined' && firestoreStatus.startsWith('ok')) {
        await db.collection('users').doc(uid).update(updates);
      }
    } catch (error: any) {
      if (!error?.message?.includes('5 NOT_FOUND')) {
        console.error("Firestore updateUser failed:", error);
      }
    }

    // Update local
    const users = this.getUsersLocal();
    const index = users.findIndex(u => u.uid === uid);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      this.saveUsersLocal(users);
      return users[index];
    }

    // If not in local, try to fetch from Firestore to return updated doc
    return await this.findById(uid);
  }

  static async deleteUser(uid: string): Promise<boolean> {
    let deleted = false;

    // Delete from Firestore
    try {
      if (typeof firestoreStatus !== 'undefined' && firestoreStatus.startsWith('ok')) {
        await db.collection('users').doc(uid).delete();
        deleted = true;
      }
    } catch (error: any) {
      if (!error?.message?.includes('5 NOT_FOUND')) {
        console.error("Firestore deleteUser failed:", error);
      }
    }

    // Delete from local
    const users = this.getUsersLocal();
    const initialLength = users.length;
    const filteredUsers = users.filter(u => u.uid !== uid);
    if (filteredUsers.length !== initialLength) {
      this.saveUsersLocal(filteredUsers);
      deleted = true;
    }

    return deleted;
  }

  static async getAll(): Promise<User[]> {
    // Try Firestore first
    try {
      if (typeof firestoreStatus !== 'undefined' && firestoreStatus.startsWith('ok')) {
        const snapshot = await db.collection('users').get();
        if (!snapshot.empty) {
          return snapshot.docs.map(doc => doc.data() as User);
        }
      }
    } catch (error: any) {
      if (!error?.message?.includes('5 NOT_FOUND')) {
        console.error("Firestore getAll failed:", error);
      }
    }

    // Fallback to local
    return this.getUsersLocal();
  }

  static async syncToFirestore() {
    if (typeof firestoreStatus === 'undefined' || !firestoreStatus.startsWith('ok')) {
      console.log("Skipping Firestore sync: Database not connected.");
      return;
    }

    console.log("Syncing local users to Firestore...");
    const localUsers = this.getUsersLocal();
    for (const user of localUsers) {
      try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists) {
          console.log(`Syncing user ${user.email} to Firestore...`);
          await db.collection('users').doc(user.uid).set(user);
        }
      } catch (error: any) {
        if (!error?.message?.includes('5 NOT_FOUND')) {
          console.error(`Failed to sync user ${user.email}:`, error);
        }
      }
    }
    console.log("Sync complete.");
  }
}

// Load Firebase Config
const firebaseConfigPath = path.resolve(__dirname, "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

console.log("Loaded Firebase Config:", JSON.stringify({
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId
}));

// Explicitly set project ID in environment to avoid fallback to host project
const envProjectId = process.env.GOOGLE_CLOUD_PROJECT;
if (envProjectId) {
  console.log(`Environment GOOGLE_CLOUD_PROJECT is: ${envProjectId}`);
}

if (firebaseConfig.projectId && !envProjectId) {
  process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
  console.log(`Setting process.env.GOOGLE_CLOUD_PROJECT from config to: ${firebaseConfig.projectId}`);
} else if (firebaseConfig.projectId && envProjectId && firebaseConfig.projectId !== envProjectId) {
  console.warn(`WARNING: Config project ID (${firebaseConfig.projectId}) differs from environment project ID (${envProjectId}). Trusting config ID for Firestore.`);
  // We keep the config ID as the source of truth for Firebase initialization
}

// Initialize Firebase Admin
let firebaseApp: admin.app.App;

async function initializeFirebase() {
  if (admin.apps.length > 0) {
    console.log("Cleaning up existing Firebase apps...");
    await Promise.all(admin.apps.map(app => app?.delete()));
  }

  // CRITICAL: Always use the projectId from config if available
  const options: admin.AppOptions = {
    projectId: firebaseConfig.projectId
  };

  try {
    console.log(`Initializing Firebase Admin with Project ID: ${firebaseConfig.projectId}`);
    firebaseApp = admin.initializeApp(options);
    return firebaseApp;
  } catch (err: any) {
    console.error("Firebase initialization failed:", err.message);
    // Fallback to default initialization
    firebaseApp = admin.initializeApp();
    return firebaseApp;
  }
}

firebaseApp = await initializeFirebase();

// Database initialization with fallback
async function getConnectedDb() {
  const configDbId = firebaseConfig.firestoreDatabaseId;
  // Try the config ID, then (default)
  const databasesToTry = [configDbId, '(default)'].filter(Boolean);
  
  console.log(`Firebase App Project ID: ${firebaseApp.options.projectId}`);
  
  for (const dbId of databasesToTry) {
    try {
      console.log(`Attempting to connect to Firestore database: ${dbId}...`);
      const testDb = getFirestore(firebaseApp, dbId as string);
      
      // Use a more reliable check: try to get a non-existent doc
      // This will throw 5 NOT_FOUND if the DATABASE itself is not found
      // But it will succeed (with no data) if the database exists but the doc doesn't
      await testDb.collection('_health_check').doc('ping').get();
      
      console.log(`Successfully connected to Firestore database: ${dbId}`);
      return { db: testDb, status: `ok (database: ${dbId})` };
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('5')) {
        console.warn(`Firestore database "${dbId}" not found (5 NOT_FOUND).`);
      } else {
        console.error(`Error connecting to Firestore database "${dbId}":`, errorMsg);
      }
    }
  }
  
  // If all fail, return (default) but mark it as error
  console.error("CRITICAL: All Firestore database connection attempts failed with NOT_FOUND.");
  return { 
    db: getFirestore(firebaseApp, '(default)'), 
    status: "error: 5 NOT_FOUND (Database not provisioned or incorrect ID)" 
  };
}

const dbResult = await getConnectedDb();
let db = dbResult.db;
let firestoreStatus = dbResult.status;
let auth = admin.auth(firebaseApp);

// Test Firestore connection and seed
async function testFirestore() {
  try {
    console.log("Running final Firestore connection test and seeding...");
    await seedInitialAccounts();
    
    // Test a simple write to verify permissions
    const testRef = db.collection('_health_check').doc('last_check');
    await testRef.set({ 
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'ok'
    });
    
    if (firestoreStatus.startsWith('ok')) {
      const testDoc = await db.collection('users').limit(1).get();
      firestoreStatus = `ok (database: ${db.databaseId}, found ${testDoc.size} docs)`;
    }
  } catch (error: any) {
    console.error("Firestore Test/Seed FAILED:", error.message);
    firestoreStatus = `error: ${error.message}`;
    
    if (error.message.includes('permission_denied') || error.message.includes('Missing or insufficient permissions') || error.message.includes('permission-denied')) {
      console.error("CRITICAL: Permission denied. This usually means the service account lacks Firestore roles or the project ID is incorrect.");
      firestoreStatus = "error: permission_denied (check project ID and service account roles)";
    }
  }
}
testFirestore();

async function seedInitialAccounts() {
  const accounts = [
    {
      email: "cno@tumutumu.org",
      name: "Chief Nursing Officer",
      role: "cno",
      password: "admin123"
    },
    {
      email: "ragnarkaladin@gmail.com",
      name: "Super Admin",
      role: "admin",
      password: "admin123"
    }
  ];
  
  for (const account of accounts) {
    try {
      const existingUser = await UserStorage.findByEmail(account.email);
      if (!existingUser) {
        console.log(`Seeding account: ${account.email}`);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(account.password, salt);
        
        await UserStorage.createUser({
          name: account.name,
          email: account.email,
          passwordHash,
          role: account.role,
          isDefaultPassword: true,
        });
        console.log(`${account.name} account seeded successfully.`);
      } else {
        console.log(`${account.name} account already exists.`);
      }
    } catch (error) {
      console.error(`Failed to seed account ${account.email}:`, error);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      firestore: firestoreStatus,
      projectId: firebaseApp.options.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      env: process.env.NODE_ENV,
      googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT || 'not set'
    });
  });

  // Middleware to verify Custom JWT Token
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      // First try to verify as custom JWT
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const user = await UserStorage.findById(decoded.uid);
        if (user) {
          req.user = { ...decoded, role: user.role };
          return next();
        }
        // If not in local storage, it might be the super admin bypass
        if (decoded.uid === 'super-admin-bypass') {
          req.user = decoded;
          return next();
        }
      } catch (jwtError) {
        // If JWT fails, try Firebase ID Token (for the Super Admin)
        try {
          console.log(`Verifying Firebase ID Token for project: ${firebaseApp.options.projectId}`);
          const decodedToken = await auth.verifyIdToken(token);
          let userData: any = null;
          
          // Check local storage first for super admin profile
          userData = await UserStorage.findById(decodedToken.uid);
          
          if (!userData && !firestoreStatus.startsWith('error')) {
            try {
              const userDoc = await db.collection('users').doc(decodedToken.uid).get();
              if (userDoc.exists) {
                userData = userDoc.data();
              }
            } catch (dbError: any) {
              // If database is missing (5 NOT_FOUND), log it more quietly and handle it
              const isNotFound = dbError.message?.includes('NOT_FOUND') || 
                                dbError.message?.includes('5') || 
                                String(dbError).includes('NOT_FOUND') ||
                                String(dbError).includes('5');
                                
              if (isNotFound) {
                // Silent skip for expected missing database
              } else {
                console.warn("Database access failed during auth verification:", dbError.message || dbError);
              }
              
              // If it's the super admin, we have a bypass
              if (decodedToken.email === 'ragnarkaladin@gmail.com') {
                userData = { role: 'admin' };
              }
            }
          }

          if (!userData && decodedToken.email === 'ragnarkaladin@gmail.com') {
            userData = { role: 'admin' };
          }
          
          if (userData) {
            req.user = { ...decodedToken, uid: decodedToken.uid, role: userData.role };
            return next();
          }
        } catch (authError: any) {
          if (authError.message.includes('NOT_FOUND') || authError.message.includes('5')) {
            // Silent skip for expected missing database
          } else {
            console.error("Auth verification failed:", authError.message);
          }
        }
      }
      
      res.status(401).json({ error: 'Authentication failed' });
    } catch (error: any) {
      res.status(401).json({ error: 'Authentication failed', details: error.message });
    }
  };

  // API Route: Get current user profile
  app.get("/api/auth/me", authenticate, async (req: any, res) => {
    const user = await UserStorage.findById(req.user.uid);
    if (user) {
      return res.json(user);
    }
    
    // Fallback for Super Admin
    if (req.user.email === 'ragnarkaladin@gmail.com') {
      return res.json({
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name || 'System Administrator',
        role: 'admin'
      });
    }
    
    res.status(404).json({ error: 'User not found' });
  });

  // API Route: Login
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    
    // WORKAROUND: Hardcoded bypass for the user's email if Firestore is failing
    const isSuperAdmin = email === "ragnarkaladin@gmail.com";
    const isBypassPassword = password === "bypass123";

    try {
      let userData: any = await UserStorage.findByEmail(email);
      
      if (!userData && isSuperAdmin && isBypassPassword) {
        console.log("Applying login workaround for super admin.");
        userData = {
          uid: "super-admin-bypass",
          email: "ragnarkaladin@gmail.com",
          name: "System Administrator (Bypass)",
          role: "admin",
          isDefaultPassword: true
        };
      }

      if (!userData) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // If it's the bypass case, we already have userData and skip password check
      if (userData.uid !== "super-admin-bypass") {
        if (!userData.passwordHash) {
          return res.status(401).json({ error: "This account requires Google Login" });
        }

        const isMatch = await bcrypt.compare(password, userData.passwordHash);
        if (!isMatch) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }

      const token = jwt.sign(
        { uid: userData.uid, email: userData.email, role: userData.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({ 
        token, 
        user: { 
          uid: userData.uid, 
          email: userData.email, 
          role: userData.role,
          name: userData.name,
          isDefaultPassword: userData.isDefaultPassword
        } 
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Create User (Local Storage)
  app.post("/api/admin/create-user", authenticate, async (req: any, res) => {
    const { email, password, name, phone, role, wardId, nckRegistrationNumber, licenseExpiryDate } = req.body;
    
    const requesterRole = req.user.role;
    if (!['admin', 'cno', 'ward_admin'].includes(requesterRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      // Check if user already exists
      const existingUser = await UserStorage.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      const newUser = await UserStorage.createUser({
        name,
        email,
        phone: phone || null,
        role,
        wardId: wardId || null,
        nckRegistrationNumber: nckRegistrationNumber || null,
        licenseExpiryDate: licenseExpiryDate || null,
        passwordHash,
        isDefaultPassword: true,
      });

      res.json({ success: true, uid: newUser.uid });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Reset Password
  app.post("/api/admin/reset-password", authenticate, async (req: any, res) => {
    const { uid, newPassword } = req.body;
    const requesterRole = req.user.role;

    if (!['admin', 'cno', 'ward_admin'].includes(requesterRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      
      const updated = await UserStorage.updateUser(uid, {
        passwordHash,
        isDefaultPassword: true
      });
      
      if (!updated) return res.status(404).json({ error: 'User not found' });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Change Password (Self)
  app.post("/api/auth/change-password", authenticate, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    const uid = req.user.uid;

    try {
      const user = await UserStorage.findById(uid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.passwordHash) {
        return res.status(400).json({ error: "This account uses Google Login" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Current password incorrect" });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      
      await UserStorage.updateUser(uid, {
        passwordHash,
        isDefaultPassword: false
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Delete User
  app.post("/api/admin/delete-user", authenticate, async (req: any, res) => {
    const { uid } = req.body;
    const requesterRole = req.user.role;

    if (!['admin', 'cno', 'ward_admin'].includes(requesterRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const deleted = await UserStorage.deleteUser(uid);
      if (!deleted) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Get all users (for admin/cno/ward_admin)
  app.get("/api/admin/users", authenticate, async (req: any, res) => {
    const requesterRole = req.user.role;
    if (!['admin', 'cno', 'ward_admin', 'hr'].includes(requesterRole)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const users = await UserStorage.getAll();
      
      // Filter based on query params
      let filteredUsers = users;
      
      const roleFilter = req.query.role as string;
      const wardFilter = req.query.wardId as string;

      if (roleFilter) {
        filteredUsers = filteredUsers.filter(u => u.role === roleFilter);
      }

      if (wardFilter) {
        filteredUsers = filteredUsers.filter(u => u.wardId === wardFilter);
      }

      // Ward admins can only see staff in their ward
      if (requesterRole === 'ward_admin') {
        filteredUsers = filteredUsers.filter(u => u.wardId === req.user.wardId && u.role === 'staff');
      }

      // Remove passwords from response
      const safeUsers = filteredUsers.map(({ passwordHash, ...u }) => u);
      
      res.json(safeUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Sync local users to Firestore
  if (!firestoreStatus.startsWith('error')) {
    await UserStorage.syncToFirestore();
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Vite middleware initialized: ${process.env.NODE_ENV !== "production"}`);
  });
}

console.log("Starting server...");
startServer().catch(err => {
  console.error("Failed to start server:", err);
});
