import mongoose from 'mongoose';
import Role from '../models/roleModel';
import dotenv from 'dotenv';

dotenv.config();

const roles = [
  { name: 'superadmin' },
  { name: 'user' }
];

async function seedRoles() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.CONNECTION_STRING || '');
    console.log('Connected to MongoDB');

    let insertedRoles = [];
    for (const role of roles) {
      const exists = await Role.findOne({ name: role.name });
      if (!exists) {
        const newRole = await Role.create(role);
        insertedRoles.push(newRole);
        console.log(`Inserted role: ${role.name}`);
      } else {
        console.log(`Role already exists: ${role.name}`);
      }
    }

    if (insertedRoles.length) {
      console.log('Successfully seeded roles:', insertedRoles);
    } else {
      console.log('No new roles were added.');
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  }
}

// Run the seed function
seedRoles(); 