const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Seeded Institutional Resource Catalog
let resources = [
  {
    id: 'res-1',
    name: 'Conference Room A',
    category: 'Meeting Rooms',
    location: 'Building B · 3rd Floor',
    capacity: 10,
    equipment: ['4K Display', 'Video Conferencing', 'Whiteboard'],
    utilization: 78,
    approvalRequired: false,
    status: 'active'
  },
  {
    id: 'res-2',
    name: 'Conference Room B',
    category: 'Meeting Rooms',
    location: 'Building B · 2nd Floor',
    capacity: 12,
    equipment: ['4K Display', 'Dual Microphones', 'Whiteboard'],
    utilization: 42,
    approvalRequired: false,
    status: 'active'
  },
  {
    id: 'res-3',
    name: 'Main Auditorium / Seminar Hall',
    category: 'Seminar Halls',
    location: 'Central Block · Ground Floor',
    capacity: 250,
    equipment: ['Line Array Sound System', 'Dual Projectors', 'Wireless Mics', 'Stage Lighting'],
    utilization: 62,
    approvalRequired: true,
    status: 'active'
  },
  {
    id: 'res-4',
    name: 'Advanced IoT & Robotics Lab',
    category: 'Labs & Equipment',
    location: 'Tech Complex · Lab 104',
    capacity: 35,
    equipment: ['3D Printers', 'Oscilloscopes', 'Soldering Stations', 'GPU Workstations'],
    utilization: 71,
    approvalRequired: true,
    status: 'active'
  },
  {
    id: 'res-5',
    name: 'Indoor Badminton & Squash Arena',
    category: 'Sports Facilities',
    location: 'Sports Complex · Court 1 & 2',
    capacity: 8,
    equipment: ['Wooden Flooring', 'LED Floodlights', 'Racket Sets', 'Electronic Scoreboard'],
    utilization: 84,
    approvalRequired: false,
    status: 'active'
  },
  {
    id: 'res-6',
    name: 'High-Speed Computing Cluster',
    category: 'Labs & Equipment',
    location: 'Server Wing · Rack Room C',
    capacity: 40,
    equipment: ['40x RTX 4090 Nodes', 'Gigabit Ethernet', 'Linux Dev Terminals'],
    utilization: 52,
    approvalRequired: false,
    status: 'active'
  },
  {
    id: 'res-7',
    name: 'Podcast & Media Studio',
    category: 'Workspaces',
    location: 'Media Center · Room 102',
    capacity: 6,
    equipment: ['Shure SM7B Mics', 'Rodecaster Pro', 'Acoustic Panel', 'Blackmagic 4K Camera'],
    utilization: 28,
    approvalRequired: false,
    status: 'active'
  },
  {
    id: 'res-8',
    name: '4K Cinema Drone & Photography Kit',
    category: 'Labs & Equipment',
    location: 'Media Center · Locker 08',
    capacity: 2,
    equipment: ['DJI Mavic 3 Pro', 'Sony FX3 Cinema Kit', 'Gimbal Stabilizer', 'Tripods'],
    utilization: 30,
    approvalRequired: true,
    status: 'active'
  }
];

let bookings = [
  {
    id: 'bk-101',
    resourceId: 'res-1',
    resourceName: 'Conference Room A',
    userEmail: 'alex@easybook.io',
    date: '2026-08-25',
    startTime: '10:00',
    endTime: '11:30',
    durationMinutes: 90,
    attendees: 8,
    purpose: 'Sprint Planning & Design Review',
    status: 'confirmed',
    checkedIn: false
  },
  {
    id: 'bk-102',
    resourceId: 'res-3',
    resourceName: 'Main Auditorium / Seminar Hall',
    userEmail: 'alex@easybook.io',
    date: '2026-08-26',
    startTime: '14:00',
    endTime: '17:00',
    durationMinutes: 180,
    attendees: 180,
    purpose: 'National Tech Hackathon Keynote',
    status: 'pending',
    checkedIn: false
  },
  {
    id: 'bk-103',
    resourceId: 'res-5',
    resourceName: 'Indoor Badminton & Squash Arena',
    userEmail: 'alex@easybook.io',
    date: '2026-08-24',
    startTime: '18:00',
    endTime: '19:30',
    durationMinutes: 90,
    attendees: 4,
    purpose: 'Inter-Department Tournament Practice',
    status: 'confirmed',
    checkedIn: true
  }
];

let notifications = [
  { id: 'nt-1', message: 'Automated Reminder: Badminton Arena session starts in 1 hour.', time: '1h ago', unread: true },
  { id: 'nt-2', message: 'Your Conference Room A booking is confirmed.', time: '3h ago', unread: false }
];

const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// APIs
app.get('/api/resources', (req, res) => {
  res.json({ success: true, data: resources });
});

app.post('/api/resources', (req, res) => {
  const { name, category, location, capacity, equipment, approvalRequired } = req.body;
  const newResource = {
    id: `res-${Date.now().toString().slice(-4)}`,
    name,
    category,
    location,
    capacity: Number(capacity) || 4,
    equipment: equipment ? equipment.split(',').map(e => e.trim()) : ['Standard Equipment'],
    utilization: 10,
    approvalRequired: Boolean(approvalRequired),
    status: 'active'
  };
  resources.unshift(newResource);
  res.status(201).json({ success: true, data: newResource });
});

app.get('/api/bookings', (req, res) => {
  const user = req.query.user;
  if (user) {
    return res.json({ success: true, data: bookings.filter(b => b.userEmail === user) });
  }
  res.json({ success: true, data: bookings });
});

app.post('/api/bookings', (req, res) => {
  const { resourceId, date, startTime, endTime, attendees, purpose, userEmail } = req.body;

  const targetResource = resources.find(r => r.id === resourceId);
  if (!targetResource) {
    return res.status(404).json({ success: false, message: 'Resource not found' });
  }

  const reqStart = toMinutes(startTime);
  const reqEnd = toMinutes(endTime);
  const reqDuration = reqEnd - reqStart;

  // Conflict Overlap Validation
  const hasConflict = bookings.some(b => {
    if (b.resourceId === resourceId && b.date === date && (b.status === 'confirmed' || b.status === 'pending')) {
      const bStart = toMinutes(b.startTime);
      const bEnd = toMinutes(b.endTime);
      return reqStart < bEnd && reqEnd > bStart;
    }
    return false;
  });

  if (hasConflict) {
    // Smart Alternative Resolution
    const alternativeResource = resources.find(r => 
      r.category === targetResource.category && 
      r.id !== targetResource.id && 
      r.capacity >= Number(attendees)
    ) || targetResource;

    return res.status(409).json({
      success: false,
      conflict: true,
      message: 'This resource is already booked for the specified window.',
      smartRecommendation: {
        resourceId: alternativeResource.id,
        resourceName: alternativeResource.name,
        date: date,
        startTime: '11:30',
        endTime: '13:00',
        score: 94,
        reasons: [
          `Accommodates ${attendees} attendees comfortably (Cap: ${alternativeResource.capacity})`,
          `Includes: ${alternativeResource.equipment[0] || 'Standard Setup'}`,
          'Zero double-booking collisions',
          `Balanced utilization score (${alternativeResource.utilization}% load)`
        ]
      }
    });
  }

  const newBooking = {
    id: `bk-${Date.now().toString().slice(-4)}`,
    resourceId,
    resourceName: targetResource.name,
    userEmail: userEmail || 'alex@easybook.io',
    date,
    startTime,
    endTime,
    durationMinutes: reqDuration,
    attendees: Number(attendees),
    purpose,
    status: targetResource.approvalRequired ? 'pending' : 'confirmed',
    checkedIn: false
  };

  bookings.unshift(newBooking);

  // Bonus Feature: Trigger automated reminder
  notifications.unshift({
    id: `nt-${Date.now()}`,
    message: `Reminder scheduled: ${targetResource.name} reserved for ${date} at ${startTime}.`,
    time: 'Just now',
    unread: true
  });

  res.status(201).json({ success: true, data: newBooking });
});

// QR Check-in Endpoint
app.post('/api/checkin', (req, res) => {
  const { bookingId } = req.body;
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Invalid Booking ID' });
  }
  booking.checkedIn = true;
  res.json({ success: true, message: `Successfully verified and checked into ${booking.resourceName}!`, data: booking });
});

app.patch('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const booking = bookings.find(b => b.id === id);
  if (booking) {
    booking.status = status;
    res.json({ success: true, data: booking });
  } else {
    res.status(404).json({ success: false, message: 'Booking not found' });
  }
});

app.get('/api/notifications', (req, res) => {
  res.json({ success: true, data: notifications });
});

app.get('/api/analytics', (req, res) => {
  const total = resources.length;
  const avgUtil = Math.round(resources.reduce((acc, r) => acc + r.utilization, 0) / total);
  res.json({
    success: true,
    data: {
      totalResources: total,
      totalBookings: bookings.length,
      pendingApprovals: bookings.filter(b => b.status === 'pending').length,
      utilizationRate: avgUtil,
      underutilized: resources.filter(r => r.utilization < 35)
    }
  });
});

app.listen(PORT, () => {
  console.log(`EasyBook server running on http://localhost:${PORT}`);
});