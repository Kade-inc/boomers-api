import mongoose from 'mongoose';
import User from '../models/userModel';
import Role from '../models/roleModel';
import dotenv from 'dotenv';

dotenv.config();

async function updateUserRoles() {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING || '');
    console.log('Connected to MongoDB');

    // Find the 'user' role
    const userRole = await Role.findOne({ name: 'user' });
    if (!userRole) {
      console.log("'user' role not found. Please run seed:roles first.");
      await mongoose.disconnect();
      return;
    }

    // Update users missing the role field
    const result = await User.updateMany(
      { $or: [ { role: { $exists: false } }, { role: null } ] },
      { $set: { role: userRole._id } }
    );

    console.log(`Updated ${result.modifiedCount} users to have the 'user' role.`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error updating user roles:', error);
    process.exit(1);
  }
}

updateUserRoles(); 