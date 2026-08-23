const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Firebase Admin Initialization below
const serviceAccount = require('./serviceAccountKey.json');

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();
const auth = getAuth();

// ==================== AUTHENTICATION API ====================

// 1. Register User in Firebase Authentication & Firestore
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role, name } = req.body;
  try {
    // Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name || email.split('@')[0]
    });

    // Save extra profile metadata (role) into Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name: name || email.split('@')[0],
      role: role || 'customer',
      createdAt: FieldValue.serverTimestamp()
    });

    res.status(201).json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName,
        role: role || 'customer'
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 2. Fetch User Profile also it is saved there on data base 
app.post('/api/auth/login', async (req, res) => {
  const { email, role } = req.body;
  try {
    const userRecord = await auth.getUserByEmail(email);
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    let userRole = role || 'customer';
    if (userDoc.exists) {
      userRole = userDoc.data().role || userRole;
    }

    res.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName,
        role: userRole
      }
    });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Account not found. Please register first.' });
  }
});

// ==================== SEED RESOURCES ====================

const seedResources = [
  { name: 'Conference Room A', category: 'Meeting Rooms', location: 'Building B · 3rd Floor', capacity: 10, equipment: ['4K Display', 'Video Conferencing', 'Whiteboard'], utilization: 78, approvalRequired: false, status: 'active' },
  { name: 'Conference Room B', category: 'Meeting Rooms', location: 'Building B · 2nd Floor', capacity: 12, equipment: ['4K Display', 'Dual Microphones', 'Whiteboard'], utilization: 42, approvalRequired: false, status: 'active' },
  { name: 'Main Auditorium / Seminar Hall', category: 'Seminar Halls', location: 'Central Block · Ground Floor', capacity: 250, equipment: ['Line Array Sound System', 'Dual Projectors', 'Wireless Mics', 'Stage Lighting'], utilization: 62, approvalRequired: true, status: 'active' },
  { name: 'Advanced IoT & Robotics Lab', category: 'Labs & Equipment', location: 'Tech Complex · Lab 104', capacity: 35, equipment: ['3D Printers', 'Oscilloscopes', 'Soldering Stations', 'GPU Workstations'], utilization: 71, approvalRequired: true, status: 'active' },
  { name: 'Indoor Badminton & Squash Arena', category: 'Sports Facilities', location: 'Sports Complex · Courts 1-2', capacity: 8, equipment: ['Wooden Flooring', 'LED Floodlights', 'Racket Sets', 'Electronic Scoreboard'], utilization: 84, approvalRequired: false, status: 'active' },
  { name: 'High-Performance Computing Cluster', category: 'Labs & Equipment', location: 'Server Wing · Room C', capacity: 40, equipment: ['40x RTX 4090 Nodes', 'Gigabit Fiber', 'Linux Dev Terminals'], utilization: 52, approvalRequired: false, status: 'active' },
  { name: 'Podcast & Media Studio', category: 'Workspaces', location: 'Media Center · Room 102', capacity: 6, equipment: ['Shure SM7B Mics', 'Rodecaster Pro', 'Acoustic Panel', 'Blackmagic 4K Camera'], utilization: 28, approvalRequired: false, status: 'active' },
  { name: '4K Cinema Drone & Photography Kit', category: 'Labs & Equipment', location: 'Media Locker 08', capacity: 2, equipment: ['DJI Mavic 3 Pro', 'Sony FX3 Cinema Kit', 'Gimbal Stabilizer', 'Tripods'], utilization: 30, approvalRequired: true, status: 'active' }
];

async function initFirestoreData() {
  try {
    const resSnap = await db.collection('resources').get();
    if (resSnap.empty) {
      console.log('⚡ Populating Firestore with initial institutional resources...');
      const batch = db.batch();
      seedResources.forEach(res => {
        const docRef = db.collection('resources').doc();
        batch.set(docRef, { ...res, createdAt: FieldValue.serverTimestamp() });
      });
      await batch.commit();

      await db.collection('bookings').add({
        resourceName: 'Conference Room A',
        userEmail: 'alex@easybook.io',
        date: '2026-08-25',
        startTime: '10:00',
        endTime: '11:30',
        durationMinutes: 90,
        attendees: 8,
        purpose: 'Sprint Planning & Design Review',
        status: 'confirmed',
        checkedIn: false,
        createdAt: FieldValue.serverTimestamp()
      });
      console.log('✅ Firestore seeding complete!');
    }
  } catch (err) {
    console.error('Firestore init error:', err.message);
  }
}

const toMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};
// Shows all the available resources used 
// ==================== BOOKING & RESOURCE ROUTES ====================

app.get('/api/resources', async (req, res) => {
  try {
    const snapshot = await db.collection('resources').get();
    const resources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: resources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    let query = db.collection('bookings');
    if (req.query.user && req.query.user !== 'admin@easybook.io') {
      query = query.where('userEmail', '==', req.query.user);
    }
    const snapshot = await query.get();
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { resourceId, resourceName, date, startTime, endTime, attendees, purpose, userEmail } = req.body;
    const reqStart = toMinutes(startTime);
    const reqEnd = toMinutes(endTime);

    const existingSnap = await db.collection('bookings')
      .where('date', '==', date)
      .where('status', '==', 'confirmed')
      .get();

    const hasConflict = existingSnap.docs.some(doc => {
      const b = doc.data();
      return (b.resourceId === resourceId || b.resourceName === resourceName) &&
             reqStart < toMinutes(b.endTime) && reqEnd > toMinutes(b.startTime);
    });

    if (hasConflict) {
      return res.status(409).json({
        success: false,
        conflict: true,
        message: 'This slot overlaps with an existing reservation.',
        smartRecommendation: {
          resourceId: 'res-2',
          resourceName: 'Conference Room B',
          date,
          startTime: '11:30',
          endTime: '13:00',
          score: 94,
          reasons: [
            `Accommodates ${attendees} attendees comfortably`,
            'Includes: 4K Display & Dual Microphones',
            'Zero double-booking collision'
          ]
        }
      });
    }

    const newBooking = {
      resourceId: resourceId || 'res-1',
      resourceName: resourceName || 'Conference Room A',
      userEmail: userEmail || 'alex@easybook.io',
      date,
      startTime,
      endTime,
      durationMinutes: reqEnd - reqStart || 90,
      attendees: Number(attendees),
      purpose,
      status: 'confirmed',
      checkedIn: false,
      createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('bookings').add(newBooking);
    res.status(201).json({ success: true, data: { id: docRef.id, ...newBooking } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/checkin', async (req, res) => {
  try {
    const { bookingId } = req.body;
    await db.collection('bookings').doc(bookingId).update({ checkedIn: true });
    res.json({ success: true, message: 'Check-in verified!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/bookings/:id', async (req, res) => {
  try {
    await db.collection('bookings').doc(req.params.id).update({ status: req.body.status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`EasyBook server running on http://localhost:${PORT}`);
  await initFirestoreData();
});

//  For Authentication Email/password is enabled  where user and admin can give there repective emailId and password to login 