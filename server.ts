import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Encryption settings
const ENCRYPTION_KEY = crypto.scryptSync('scc-student-aid-secret', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Simulated Email Notification System
function sendEmailNotification(to: string, subject: string, body: string, emailLogs: any[]) {
  console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
  console.log(`[BODY]: ${body}`);
  emailLogs.push({ to, subject, body, date: new Date().toISOString() });
  // In a real app, you'd use nodemailer or a service like SendGrid/Mailgun
}

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/auth/signup", async (req, res) => {
    const { schoolId, firstName, lastName, email, course, year, password, role = 'student' } = req.body;
    
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},school_id.eq.${schoolId}`)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ 
        school_id: schoolId, 
        first_name: firstName, 
        last_name: lastName, 
        email, 
        course, 
        year, 
        password: hashPassword(password), 
        role 
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "User created successfully", user: { id: newUser.id, email, firstName, lastName, role, schoolId: newUser.school_id } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { identifier, password } = req.body;
    const hashedPassword = hashPassword(password);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${identifier},school_id.eq.${identifier}`)
      .eq('password', hashedPassword)
      .single();

    if (!user || error) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role, schoolId: user.school_id, course: user.course, year: user.year } });
  });

  app.get("/api/announcements", async (req, res) => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/admin/announcements", async (req, res) => {
    const { title, content, category } = req.body;
    const { data: newAnn, error } = await supabase
      .from('announcements')
      .insert([{ title, content, category, date: new Date().toISOString() }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    
    // Notify all students about the new announcement
    const { data: students } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('role', 'student');

    if (students) {
      students.forEach(student => {
        sendEmailNotification(
          student.email,
          `New Announcement: ${title}`,
          `Hello ${student.first_name},\n\nA new announcement has been posted in the SCC Student Aid Portal:\n\n${content}\n\nCategory: ${category}\n\nBest regards,\nSCC Student Aid Office`,
          [] // We'll handle logs differently or just skip for now
        );
      });
    }

    res.json(newAnn);
  });

  app.delete("/api/admin/announcements/:id", async (req, res) => {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Announcement deleted" });
  });

  app.post("/api/applications", async (req, res) => {
    const { userId, type, details } = req.body;
    const { data: newApp, error } = await supabase
      .from('applications')
      .insert([{ user_id: userId, type, details, status: 'pending', date: new Date().toISOString() }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(newApp);
  });

  app.get("/api/applications/:userId", async (req, res) => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', req.params.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data.map(a => ({ ...a, userId: a.user_id })));
  });

  app.get("/api/admin/applications", async (req, res) => {
    const { data, error } = await supabase
      .from('applications')
      .select('*, users(first_name, last_name, school_id)');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data.map(a => ({ 
      ...a, 
      userId: a.user_id,
      user: a.users ? {
        firstName: a.users.first_name,
        lastName: a.users.last_name,
        schoolId: a.users.school_id
      } : null
    })));
  });

  app.patch("/api/applications/:id", async (req, res) => {
    const { status } = req.body;
    const { data: application, error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    
    const { data: student } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('id', application.user_id)
      .single();

    if (student) {
      sendEmailNotification(
        student.email,
        `Application Status Update: ${application.type}`,
        `Hello ${student.first_name},\n\nYour application for ${application.type} (ID: #${application.id}) has been ${status}.\n\nPlease log in to the portal for more details.\n\nBest regards,\nSCC Student Aid Office`,
        []
      );
    }

    res.json(application);
  });

  app.post("/api/upload", upload.single('file'), async (req, res) => {
    const { userId, type } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const { data: newDoc, error } = await supabase
      .from('documents')
      .insert([{
        user_id: parseInt(userId),
        type,
        filename: file.filename,
        original_name: file.originalname,
        size: file.size,
        date: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ...newDoc, userId: newDoc.user_id, originalName: newDoc.original_name });
  });

  app.get("/api/documents/:userId", async (req, res) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', req.params.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data.map(d => ({ ...d, userId: d.user_id, originalName: d.original_name })));
  });

  app.get("/api/messages/:userId", async (req, res) => {
    const userId = parseInt(req.params.userId);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data.map(m => ({ ...m, senderId: m.sender_id, receiverId: m.receiver_id })));
  });

  app.get("/api/users", async (req, res) => {
    const { role } = req.query;
    let query = supabase.from('users').select('id, school_id, first_name, last_name, email, course, year, role');
    
    if (role === 'student') {
      query = query.in('role', ['staff', 'admin']);
    } else {
      query = query.eq('role', 'student');
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data.map(u => ({ ...u, schoolId: u.school_id, firstName: u.first_name, lastName: u.last_name })));
  });

  app.get("/api/admin/users", async (req, res) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, school_id, first_name, last_name, email, course, year, role');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data.map(u => ({ ...u, schoolId: u.school_id, firstName: u.first_name, lastName: u.last_name })));
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "User deleted" });
  });

  app.get("/api/admin/reports", async (req, res) => {
    const { data: users } = await supabase.from('users').select('role');
    const { data: apps } = await supabase.from('applications').select('status, type, date');
    const { data: docs } = await supabase.from('documents').select('id');
    const { data: anns } = await supabase.from('announcements').select('title, date');

    const report = {
      totalUsers: users?.length || 0,
      totalStudents: users?.filter(u => u.role === 'student').length || 0,
      totalStaff: users?.filter(u => u.role === 'staff').length || 0,
      totalApplications: apps?.length || 0,
      pendingApplications: apps?.filter(a => a.status === 'pending').length || 0,
      approvedApplications: apps?.filter(a => a.status === 'approved').length || 0,
      rejectedApplications: apps?.filter(a => a.status === 'rejected').length || 0,
      totalDocuments: docs?.length || 0,
      recentActivity: [
        ...(apps?.slice(-5).map(a => ({ type: 'Application', detail: `New ${a.type} submitted`, date: a.date })) || []),
        ...(anns?.slice(-5).map(a => ({ type: 'Announcement', detail: `New announcement: ${a.title}`, date: a.date })) || [])
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
    res.json(report);
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room user_${userId}`);
    });

    socket.on("send_message", async (data) => {
      const { senderId, receiverId, content } = data;
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          timestamp: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (!error && newMessage) {
        const mappedMessage = { ...newMessage, senderId: newMessage.sender_id, receiverId: newMessage.receiver_id };
        // Emit to both sender and receiver
        io.to(`user_${senderId}`).emit("new_message", mappedMessage);
        io.to(`user_${receiverId}`).emit("new_message", mappedMessage);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
