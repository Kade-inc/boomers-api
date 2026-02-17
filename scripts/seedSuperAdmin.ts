import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/userModel';
import UserProfile from '../models/userProfileModel';
import Role from '../models/roleModel';
import dotenv from 'dotenv';

dotenv.config();

const superAdminEmail = 'cupman227@gmail.com';
const superAdminUsername = 'superadmin';
const superAdminPassword = 'Admin@123'; // You should change this password after first login

async function seedSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.CONNECTION_STRING || '');
    console.log('Connected to MongoDB');

    // Check if superadmin already exists
    const existingUser = await User.findOne({ email: superAdminEmail });
    if (existingUser) {
      console.log('Superadmin user already exists');
      await mongoose.disconnect();
      return;
    }

    // Get superadmin role
    const superAdminRole = await Role.findOne({ name: 'superadmin' });
    if (!superAdminRole) {
      console.log('Superadmin role not found. Please run seed:roles first.');
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(superAdminPassword, salt);

    // Create superadmin user first
    const superAdmin = await User.create({
      email: superAdminEmail,
      username: superAdminUsername,
      password: hashedPassword,
      isVerified: true,
      role: superAdminRole._id
    });

    // Create user profile with the user's ID
    const userProfile = await UserProfile.create({
      user_id: superAdmin._id,
      firstName: 'Super',
      lastName: 'Admin',
      username: superAdminUsername,
      email: superAdminEmail,
      bio: 'System Administrator',
      gender: 'male',
      job: 'Administrator',
      locationGeo: { type: 'Point', coordinates: [] }
    });

    // Update user with profile reference
    superAdmin.profile = userProfile._id as unknown as Schema.Types.ObjectId;
    await superAdmin.save();

    console.log('Superadmin user created successfully:', {
      email: superAdmin.email,
      username: superAdmin.username,
      role: superAdminRole.name
    });

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding superadmin:', error);
    process.exit(1);
  }
}

// Run the seed function
seedSuperAdmin(); 