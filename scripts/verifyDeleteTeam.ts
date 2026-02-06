import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel';
import Team from '../models/teamModel';
import TeamMember from '../models/teamMemberModel';
import TeamMemberRequest from '../models/teamMemberRequestModel';
import ShortUrl from '../models/shortUrlModel';
import Notification from '../models/notificationModel';
import Chat from '../models/chatModel';
import Message from '../models/messageModel';

dotenv.config();

const API_URL = 'http://localhost:5001/api';
const MONGO_URI = process.env.CONNECTION_STRING || '';

async function runVerification() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        // 1. Login as Super Admin via API
        const adminEmail = 'cupman227@gmail.com';
        const adminPass = 'Admin@123';

        console.log('Logging in as Super Admin...');
        let adminToken = '';
        try {
            const loginRes = await fetch(`${API_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: adminEmail,
                    password: adminPass
                })
            });

            if (!loginRes.ok) {
                const err = await loginRes.text();
                throw new Error(`Login failed: ${loginRes.status} ${err}`);
            }

            const data: any = await loginRes.json();
            adminToken = data.accessToken;
            console.log('Admin logged in.');
        } catch (e: any) {
            console.error(e.message);
            process.exit(1);
        }

        // 2. Create User (Owner) directly in DB
        const ownerEmail = `testowner_${Date.now()}@example.com`;
        console.log('Creating Test Owner...');
        const owner = await User.create({
            username: `owner${Date.now()}`,
            email: ownerEmail,
            password: 'hashedpasswordmock',
            isVerified: true
        });

        // 3. Create a Team directly in DB
        console.log('Creating Test Team...');
        const team = await Team.create({
            owner_id: owner._id,
            name: `DeleteTestTeam-${Date.now()}`,
            domain: 'Technology',
            subdomainTopics: [],
            isActive: true
        });

        // Create TeamMember (Owner)
        await TeamMember.create({
            owner_id: owner._id,
            team_id: team._id,
            user_id: owner._id
        });

        // Create Chat
        console.log('Creating Test Team Chat...');
        const chat = await Chat.create({
            members: [owner._id.toString()],
            teamId: team._id.toString(),
            isGroup: true,
            groupName: "General"
        });

        // Create Message
        console.log('Creating Test Message...');
        await Message.create({
            chatId: chat._id.toString(),
            senderId: owner._id.toString(),
            text: "This message should be deleted."
        });

        // Create ShortUrl
        await ShortUrl.create({
            code: `test${Date.now()}`,
            originalUrl: 'http://google.com',
            resourceType: 'team',
            resourceId: team._id.toString(),
            clickCount: 0
        });

        // 4. Create a User requesting to join
        const joiner = await User.create({
            username: `joiner${Date.now()}`,
            email: `joiner${Date.now()}@example.com`,
        });

        // Create Request
        await TeamMemberRequest.create({
            owner_id: owner._id,
            team_id: team._id,
            user_id: joiner._id,
            status: 'PENDING'
        });

        console.log(`Setup Complete. Team ID: ${team._id}. owner: ${owner._id}, joiner: ${joiner._id}`);

        // 5. Perform DELETE
        console.log('Deleting Team via API...');
        try {
            const deleteRes = await fetch(`${API_URL}/teams/${team._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!deleteRes.ok) {
                const err = await deleteRes.text();
                console.log('Delete response status:', deleteRes.status);
                console.error('Delete failed:', err);
            } else {
                console.log('Delete successful (200).');
            }

        } catch (e: any) {
            console.error('Delete request error:', e.message);
        }

        // 6. Verify Results
        console.log('Verifying cleanup...');

        const teamCheck = await Team.findById(team._id);
        if (!teamCheck) console.log('✅ Team deleted.');
        else console.error('❌ Team NOT deleted.');

        const dbMembers = await TeamMember.find({ team_id: team._id });
        if (dbMembers.length === 0) console.log('✅ Team Members deleted.');
        else console.error(`❌ Found ${dbMembers.length} team members!`);

        const dbRequests = await TeamMemberRequest.find({ team_id: team._id });
        if (dbRequests.length === 0) console.log('✅ Team Requests deleted.');
        else console.error(`❌ Found ${dbRequests.length} requests!`);

        const chatCheck = await Chat.findById(chat._id);
        if (!chatCheck) console.log('✅ Team Chat deleted.');
        else console.error('❌ Team Chat NOT deleted.');

        const messageCheck = await Message.findOne({ chatId: chat._id });
        if (!messageCheck) console.log('✅ Team Messages deleted.');
        else console.error('❌ Team Messages NOT deleted.');

        const notificationCheck = await Notification.findOne({ user: joiner._id, message: { $regex: /deleted/ } });
        if (notificationCheck) {
            console.log('✅ Notification created.');
        } else {
            console.error('❌ Notification NOT found!');
        }

        // Cleanup users
        await User.findByIdAndDelete(owner._id);
        await User.findByIdAndDelete(joiner._id);

        console.log('Test Complete.');
        process.exit(0);

    } catch (error) {
        console.error('Test Error:', error);
        process.exit(1);
    }
}

runVerification();
