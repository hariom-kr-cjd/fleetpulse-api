import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config/env';
import { User } from './models/user.model';
import { Vehicle } from './models/vehicle.model';
import { Trip } from './models/trip.model';
import { MaintenanceLog } from './models/maintenance-log.model';
import { Notification } from './models/notification.model';

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Vehicle.deleteMany({}),
    Trip.deleteMany({}),
    MaintenanceLog.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const hash = await bcrypt.hash('Admin123!', 10);
  const driverHash = await bcrypt.hash('Driver123!', 10);
  const managerHash = await bcrypt.hash('Manager123!', 10);

  // Users
  const admin = await User.create({
    email: 'admin@fleetpulse.com', password: hash, name: 'Hari Om (Admin)', phone: '9876543210', role: 'admin',
  });

  const managers = await User.create([
    { email: 'manager1@fleetpulse.com', password: managerHash, name: 'Ravi Kumar', phone: '9876543211', role: 'fleet_manager' },
    { email: 'manager2@fleetpulse.com', password: managerHash, name: 'Priya Sharma', phone: '9876543212', role: 'fleet_manager' },
  ]);

  const drivers = await User.create([
    { email: 'driver1@fleetpulse.com', password: driverHash, name: 'Amit Singh', phone: '9876543213', role: 'driver', availability: 'on_duty', licenseNumber: 'DL-2020-001' },
    { email: 'driver2@fleetpulse.com', password: driverHash, name: 'Vikram Patel', phone: '9876543214', role: 'driver', availability: 'on_duty', licenseNumber: 'DL-2021-002' },
    { email: 'driver3@fleetpulse.com', password: driverHash, name: 'Suresh Yadav', phone: '9876543215', role: 'driver', availability: 'on_duty', licenseNumber: 'DL-2019-003' },
    { email: 'driver4@fleetpulse.com', password: driverHash, name: 'Rajesh Gupta', phone: '9876543216', role: 'driver', availability: 'off_duty', licenseNumber: 'DL-2022-004' },
    { email: 'driver5@fleetpulse.com', password: driverHash, name: 'Manoj Tiwari', phone: '9876543217', role: 'driver', availability: 'on_duty', licenseNumber: 'DL-2023-005' },
  ]);

  console.log(`Seeded: ${1 + managers.length + drivers.length} users`);

  // Vehicles — random locations around Delhi
  const vehicleData = [
    { registrationNumber: 'DL-01-AB-1234', type: 'truck', make: 'Tata', model: 'Ace', year: 2022, status: 'active', mileage: 45000, fuelType: 'diesel' },
    { registrationNumber: 'DL-01-CD-5678', type: 'truck', make: 'Ashok Leyland', model: 'Dost', year: 2023, status: 'active', mileage: 22000, fuelType: 'diesel' },
    { registrationNumber: 'DL-02-EF-9012', type: 'van', make: 'Maruti', model: 'Eeco', year: 2021, status: 'idle', mileage: 60000, fuelType: 'petrol' },
    { registrationNumber: 'DL-02-GH-3456', type: 'van', make: 'Mahindra', model: 'Supro', year: 2023, status: 'idle', mileage: 15000, fuelType: 'diesel' },
    { registrationNumber: 'DL-03-IJ-7890', type: 'bike', make: 'Bajaj', model: 'Pulsar', year: 2024, status: 'active', mileage: 5000, fuelType: 'petrol' },
    { registrationNumber: 'DL-03-KL-1122', type: 'truck', make: 'Tata', model: 'Ultra', year: 2020, status: 'maintenance', mileage: 120000, fuelType: 'diesel' },
    { registrationNumber: 'DL-04-MN-3344', type: 'van', make: 'Force', model: 'Traveller', year: 2022, status: 'idle', mileage: 35000, fuelType: 'diesel' },
    { registrationNumber: 'DL-04-OP-5566', type: 'truck', make: 'Eicher', model: 'Pro 2049', year: 2021, status: 'active', mileage: 80000, fuelType: 'diesel' },
    { registrationNumber: 'DL-05-QR-7788', type: 'bike', make: 'Honda', model: 'Shine', year: 2024, status: 'idle', mileage: 2000, fuelType: 'petrol' },
    { registrationNumber: 'DL-05-ST-9900', type: 'truck', make: 'BharatBenz', model: '1217C', year: 2023, status: 'idle', mileage: 10000, fuelType: 'diesel' },
  ].map((v, i) => ({
    ...v,
    currentLocation: {
      lat: 28.5 + Math.random() * 0.3,
      lng: 77.0 + Math.random() * 0.4,
    },
    assignedDriverId: i < 5 ? drivers[i]._id : undefined,
  }));

  const vehicles = await Vehicle.create(vehicleData);
  console.log(`Seeded: ${vehicles.length} vehicles`);

  // Trips — mixed statuses
  const locations = [
    { address: 'Connaught Place, Delhi', lat: 28.6315, lng: 77.2167 },
    { address: 'India Gate, Delhi', lat: 28.6129, lng: 77.2295 },
    { address: 'Gurugram Cyber Hub', lat: 28.4949, lng: 77.0889 },
    { address: 'Noida Sector 62', lat: 28.6270, lng: 77.3653 },
    { address: 'Faridabad NIT', lat: 28.3670, lng: 77.3166 },
    { address: 'Jaipur Pink City', lat: 26.9124, lng: 75.7873 },
    { address: 'Agra Taj Mahal', lat: 27.1751, lng: 78.0421 },
    { address: 'Chandigarh Sector 17', lat: 30.7417, lng: 76.7868 },
  ];

  const tripData = [];
  const now = new Date();

  // 5 pending
  for (let i = 0; i < 5; i++) {
    const dIdx = i % drivers.length;
    const vIdx = i % vehicles.length;
    tripData.push({
      vehicleId: vehicles[vIdx]._id,
      driverId: drivers[dIdx]._id,
      createdBy: managers[i % 2]._id,
      origin: locations[i % locations.length],
      destination: locations[(i + 1) % locations.length],
      status: 'pending',
      distance: 10 + Math.floor(Math.random() * 200),
      estimatedDuration: 30 + Math.floor(Math.random() * 300),
    });
  }

  // 5 in_progress
  for (let i = 0; i < 5; i++) {
    const dIdx = i % drivers.length;
    const vIdx = (i + 5) % vehicles.length;
    const started = new Date(now.getTime() - (1 + Math.random() * 4) * 60 * 60 * 1000);
    tripData.push({
      vehicleId: vehicles[vIdx]._id,
      driverId: drivers[dIdx]._id,
      createdBy: admin._id,
      origin: locations[(i + 2) % locations.length],
      destination: locations[(i + 3) % locations.length],
      status: 'in_progress',
      startedAt: started,
      distance: 50 + Math.floor(Math.random() * 300),
      estimatedDuration: 60 + Math.floor(Math.random() * 240),
      checkpoints: [
        { address: `Checkpoint ${i}A`, lat: 28.5 + Math.random() * 0.3, lng: 77.0 + Math.random() * 0.4 },
      ],
    });
  }

  // 3 completed
  for (let i = 0; i < 3; i++) {
    const dIdx = i % drivers.length;
    const vIdx = i % vehicles.length;
    const started = new Date(now.getTime() - (24 + Math.random() * 48) * 60 * 60 * 1000);
    const completed = new Date(started.getTime() + (2 + Math.random() * 6) * 60 * 60 * 1000);
    tripData.push({
      vehicleId: vehicles[vIdx]._id,
      driverId: drivers[dIdx]._id,
      createdBy: managers[0]._id,
      origin: locations[(i + 4) % locations.length],
      destination: locations[(i + 5) % locations.length],
      status: 'completed',
      startedAt: started,
      completedAt: completed,
      distance: 100 + Math.floor(Math.random() * 400),
      estimatedDuration: 120 + Math.floor(Math.random() * 300),
    });
  }

  // 2 cancelled
  for (let i = 0; i < 2; i++) {
    const dIdx = (i + 3) % drivers.length;
    const vIdx = (i + 3) % vehicles.length;
    tripData.push({
      vehicleId: vehicles[vIdx]._id,
      driverId: drivers[dIdx]._id,
      createdBy: admin._id,
      origin: locations[(i + 6) % locations.length],
      destination: locations[(i + 7) % locations.length],
      status: 'cancelled',
      cancelledAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      cancelledBy: admin._id,
      distance: 80 + Math.floor(Math.random() * 150),
    });
  }

  const trips = await Trip.create(tripData);
  console.log(`Seeded: ${trips.length} trips`);

  // Maintenance logs
  const maintenanceLogs = await MaintenanceLog.create([
    { vehicleId: vehicles[0]._id, description: 'Oil change and filter replacement', cost: 2500, serviceDate: new Date('2026-03-01'), nextServiceDate: new Date('2026-06-01'), createdBy: managers[0]._id },
    { vehicleId: vehicles[1]._id, description: 'Brake pad replacement', cost: 4000, serviceDate: new Date('2026-02-15'), nextServiceDate: new Date('2026-08-15'), createdBy: managers[0]._id },
    { vehicleId: vehicles[5]._id, description: 'Engine overhaul', cost: 25000, serviceDate: new Date('2026-03-20'), nextServiceDate: new Date('2026-09-20'), createdBy: admin._id },
    { vehicleId: vehicles[2]._id, description: 'Tire rotation and alignment', cost: 3000, serviceDate: new Date('2026-03-10'), nextServiceDate: new Date('2026-04-10'), createdBy: managers[1]._id },
    { vehicleId: vehicles[7]._id, description: 'AC repair', cost: 5500, serviceDate: new Date('2026-01-25'), createdBy: managers[1]._id },
  ]);
  console.log(`Seeded: ${maintenanceLogs.length} maintenance logs`);

  // Notifications
  const notifications = await Notification.create([
    { userId: drivers[0]._id, type: 'trip_assigned', title: 'New Trip', message: `You have been assigned trip ${trips[0].tripNumber}`, tripId: trips[0]._id },
    { userId: drivers[1]._id, type: 'trip_assigned', title: 'New Trip', message: `You have been assigned trip ${trips[1].tripNumber}`, tripId: trips[1]._id },
    { userId: managers[0]._id, type: 'trip_completed', title: 'Trip Completed', message: `Trip ${trips[10].tripNumber} has been completed`, tripId: trips[10]._id },
    { userId: drivers[2]._id, type: 'maintenance_due', title: 'Maintenance Due', message: 'Vehicle DL-03-KL-1122 is due for maintenance' },
    { userId: admin._id, type: 'general', title: 'System Update', message: 'FleetPulse v1.0 deployed successfully' },
  ]);
  console.log(`Seeded: ${notifications.length} notifications`);

  console.log('\n✅ Seed complete!');
  console.log('\nTest Credentials:');
  console.log('  Admin:         admin@fleetpulse.com / Admin123!');
  console.log('  Fleet Manager: manager1@fleetpulse.com / Manager123!');
  console.log('  Driver:        driver1@fleetpulse.com / Driver123!');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
