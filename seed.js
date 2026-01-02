require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Classroom = require('./models/Classroom');
const Halqa = require('./models/Halqa');
const Guardian = require('./models/Guardian');
const Student = require('./models/Student');

const seedData = async () => {
    try {
        await connectDB();

        // Clear existing data
        await User.deleteMany({});
        await Classroom.deleteMany({});
        await Halqa.deleteMany({});
        await Guardian.deleteMany({});
        await Student.deleteMany({});

        console.log('🗑️  Cleared existing data');

        // Create Users
        // Production Seed: Single Director Account
        const directorEmail = 'director@madarij.com';
        let director = await User.findOne({ email: directorEmail });

        if (!director) {
            console.log('Creating Master Director Account...');
            director = await User.create({
                name: 'مدير المركز',
                email: directorEmail,
                password: 'admin123', // Should be changed after first login
                role: 'director',
                phone: '01000000000'
            });
            console.log('Master Director Created: director@madarij.com / admin123');
        } else {
            console.log('Master Director already exists.');
        }

        // In production, we do NOT seed other users or dummy data automatically
        if (process.env.NODE_ENV !== 'production') {
            // Optional: Seed dummy data only in development
            // ... (Commented out or moved to a separate dev-seed function)
        }

        // For the handover, we only return the director
        const users = [director];

        console.log('👥 Created users');

        // Create Fixed Classrooms (Production Ready)
        const fixedClassrooms = [
            { name: 'الفصل الأساسي', capacity: 30, description: 'الفصل الرئيسي للحلقات' },
            { name: 'الفصل الثاني', capacity: 25, description: 'الفصل الإضافي' }
        ];

        for (const classroomData of fixedClassrooms) {
            const exists = await Classroom.findOne({ name: classroomData.name });
            if (!exists) {
                await Classroom.create(classroomData);
                console.log(`🏫 Created classroom: ${classroomData.name}`);
            }
        }

        // Get user references
        const directorUser = users.find(u => u.role === 'director');
        const supervisors = users.filter(u => u.role === 'supervisor');
        const teachers = users.filter(u => u.role === 'teacher');

        // Check if we have enough staff to create full demo data
        if (teachers.length === 0 || supervisors.length === 0) {
            console.log('⚠️  Production Mode detected (Director only). Skipping demo data (Halqat, Students, etc).');
            console.log('\n✅ Seed data completed successfully! (Master Account + Fixed Classrooms)');
            console.log('\n📝 Login Credentials:');
            console.log('   Master Director: director@madarij.com / admin123');
            process.exit(0);
        }

        // Fetch created classrooms for demo data usage
        const classrooms = await Classroom.find();

        console.log('🏫 Created classrooms');

        // Create Halqat
        // const halqat = await Halqa.create([
        //     {
        //         name: 'حلقة أبو بكر الصديق',
        //         classroom: classrooms[0]._id,
        //         teacher: teachers[0]._id,
        //         supervisor: supervisors[0]._id,
        //         days: ['السبت', 'الإثنين'],
        //         startTime: '14:00',
        //         endTime: '16:00',
        //         maxStudents: 15
        //     },
        //     {
        //         name: 'حلقة عمر بن الخطاب',
        //         classroom: classrooms[0]._id,
        //         teacher: teachers[0]._id,
        //         supervisor: supervisors[0]._id,
        //         days: ['الأحد', 'الثلاثاء'],
        //         startTime: '14:00',
        //         endTime: '16:00',
        //         maxStudents: 15
        //     },
        //     {
        //         name: 'حلقة عثمان بن عفان',
        //         classroom: classrooms[1]._id,
        //         teacher: teachers[1]._id,
        //         supervisor: supervisors[1]._id,
        //         days: ['السبت', 'الإثنين'],
        //         startTime: '16:00',
        //         endTime: '18:00',
        //         maxStudents: 15
        //     },
        //     {
        //         name: 'حلقة أبي بن كعب',
        //         classroom: classrooms[1]._id,
        //         teacher: teachers[1]._id,
        //         supervisor: supervisors[2]._id,
        //         days: ['الأحد', 'الأربعاء'],
        //         startTime: '14:00',
        //         endTime: '16:00',
        //         maxStudents: 15
        //     }
        // ]);

        console.log('📖 Created halqat');

        // Create Guardians
        // const guardians = await Guardian.create([
        //     { name: 'أحمد محمود', phone: '01111111111', relationship: 'أب' },
        //     { name: 'محمد علي', phone: '01122222222', relationship: 'أب' },
        //     { name: 'عمر حسن', phone: '01133333333', relationship: 'أب' },
        //     { name: 'يوسف إبراهيم', phone: '01144444444', relationship: 'أب' },
        //     { name: 'سالم عبدالله', phone: '01155555555', relationship: 'عم' }
        // ]);

        console.log('👨‍👧 Created guardians');

        // Create Students
        // const students = await Student.create([
        //     {
        //         name: 'عبدالله أحمد',
        //         age: 10,
        //         stage: 'ابتدائي',
        //         halqa: halqat[0]._id,
        //         guardian: guardians[0]._id,
        //         currentJuz: 1,
        //         currentSurah: 'البقرة'
        //     },
        //     {
        //         name: 'يوسف محمد',
        //         age: 11,
        //         stage: 'ابتدائي',
        //         halqa: halqat[0]._id,
        //         guardian: guardians[1]._id,
        //         currentJuz: 2,
        //         currentSurah: 'آل عمران'
        //     },
        //     {
        //         name: 'عمر علي',
        //         age: 14,
        //         stage: 'إعدادي',
        //         halqa: halqat[1]._id,
        //         guardian: guardians[2]._id,
        //         currentJuz: 5,
        //         currentSurah: 'النساء'
        //     },
        //     {
        //         name: 'حسن يوسف',
        //         age: 16,
        //         stage: 'ثانوي',
        //         halqa: halqat[2]._id,
        //         guardian: guardians[3]._id,
        //         currentJuz: 10,
        //         currentSurah: 'الأنفال'
        //     },
        //     {
        //         name: 'إبراهيم سالم',
        //         age: 20,
        //         stage: 'جامعة',
        //         halqa: halqat[3]._id,
        //         guardian: guardians[4]._id,
        //         currentJuz: 15,
        //         currentSurah: 'الإسراء'
        //     },
        //     {
        //         name: 'خالد عمر',
        //         age: 9,
        //         stage: 'ابتدائي',
        //         halqa: halqat[0]._id,
        //         guardian: guardians[0]._id,
        //         currentJuz: 1,
        //         currentSurah: 'الفاتحة'
        //     },
        //     {
        //         name: 'سليمان أحمد',
        //         age: 12,
        //         stage: 'ابتدائي',
        //         halqa: halqat[1]._id,
        //         guardian: guardians[1]._id,
        //         currentJuz: 3,
        //         currentSurah: 'النساء'
        //     },
        //     {
        //         name: 'زيد محمود',
        //         age: 15,
        //         stage: 'إعدادي',
        //         halqa: halqat[2]._id,
        //         guardian: guardians[2]._id,
        //         currentJuz: 7,
        //         currentSurah: 'الأنعام'
        //     }
        // ]);

        console.log('👦 Created students');

        console.log('\n✅ Seed data completed successfully!');
        console.log('\n📝 Login Credentials:');
        console.log('   Master Director: director@madarij.com / admin123');
        console.log('   Teacher: abdulrahman@madarij.com / 123456');
        console.log('   Supervisor: mohamed.said@madarij.com / 123456');
        console.log('   Student Affairs: sameh@madarij.com / 123456');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
