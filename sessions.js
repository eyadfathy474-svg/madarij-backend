const express = require('express');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Performance = require('../models/Performance');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/sessions
// @desc    Get sessions (filtered by date range)
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        let query = {};

        // Date Range Filtering
        if (req.query.startDate && req.query.endDate) {
            const start = new Date(req.query.startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(req.query.endDate);
            end.setHours(23, 59, 59, 999);

            query.date = { $gte: start, $lte: end };
        } else {
            // Default to today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            query.date = { $gte: today, $lt: tomorrow };
        }

        // Filter by user role
        if (req.user.role === 'teacher') {
            const Halqa = require('../models/Halqa');
            const teacherHalqat = await Halqa.find({ teacher: req.user._id });
            query.halqa = { $in: teacherHalqat.map(h => h._id) };
        }

        const sessions = await Session.find(query)
            .populate({
                path: 'halqa',
                populate: [
                    { path: 'teacher', select: 'name' },
                    { path: 'classroom', select: 'name' }
                ]
            });

        // Get attendance and performance for each session
        const sessionsWithStats = await Promise.all(
            sessions.map(async (session) => {
                const attendanceStats = await Attendance.getSessionStats(session._id);
                const totalStudents = await Student.countDocuments({
                    halqa: session.halqa._id,
                    status: 'منتظم'
                });

                return {
                    ...session.toObject(),
                    attendanceStats,
                    totalStudents
                };
            })
        );

        res.json({
            success: true,
            count: sessions.length,
            sessions: sessionsWithStats
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/sessions/:id
// @desc    Get session details
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id)
            .populate({
                path: 'halqa',
                populate: [
                    { path: 'teacher', select: 'name' },
                    { path: 'supervisor', select: 'name' },
                    { path: 'classroom', select: 'name' }
                ]
            });

        if (!session) {
            return res.status(404).json({ message: 'الجلسة غير موجودة' });
        }

        // Get students with their attendance and performance
        const students = await Student.find({ halqa: session.halqa._id, status: 'منتظم' });
        const attendance = await Attendance.find({ session: session._id });
        const performance = await Performance.find({ session: session._id });

        const studentsWithData = students.map(student => {
            const att = attendance.find(a => a.student.toString() === student._id.toString());
            const perf = performance.find(p => p.student.toString() === student._id.toString());
            return {
                ...student.toObject(),
                attendance: att ? att.status : null,
                performance: perf || null
            };
        });

        res.json({
            success: true,
            session: {
                ...session.toObject(),
                students: studentsWithData
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/sessions
// @desc    Create session
// @access  Private (Teacher)
router.post('/', protect, authorize('teacher', 'director'), async (req, res) => {
    try {
        const { halqa, date, dayType, fridayActivity, fridayStage } = req.body;

        // Check if session already exists
        const sessionDate = new Date(date);
        sessionDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(sessionDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const existingSession = await Session.findOne({
            halqa,
            date: { $gte: sessionDate, $lt: nextDay }
        });

        if (existingSession) {
            return res.status(400).json({ message: 'الجلسة موجودة بالفعل لهذا اليوم' });
        }

        const session = await Session.create({
            halqa,
            date: sessionDate,
            dayType,
            fridayActivity,
            fridayStage
        });

        const populatedSession = await Session.findById(session._id)
            .populate('halqa');

        res.status(201).json({
            success: true,
            session: populatedSession
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/sessions/:id
// @desc    Update session (status, stages)
// @access  Private (Teacher)
router.put('/:id', protect, async (req, res) => {
    try {
        const { status, stages, notes } = req.body;
        const updateData = {};

        if (status) {
            updateData.status = status;
            if (status === 'بدأت') updateData.startedAt = new Date();
            if (status === 'انتهت') updateData.endedAt = new Date();
        }

        if (stages) updateData.stages = stages;
        if (notes) updateData.notes = notes;

        const session = await Session.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('halqa');

        if (!session) {
            return res.status(404).json({ message: 'الجلسة غير موجودة' });
        }

        res.json({ success: true, session });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/sessions/:id/attendance
// @desc    Record attendance for session
// @access  Private (Teacher)
router.post('/:id/attendance', protect, authorize('teacher', 'student_affairs', 'director'), async (req, res) => {
    try {
        const { attendance } = req.body; // Array of { student, status }

        const session = await Session.findById(req.params.id);
        if (!session) {
            return res.status(404).json({ message: 'الجلسة غير موجودة' });
        }

        // Upsert attendance records
        const operations = attendance.map(({ student, status, notes }) => ({
            updateOne: {
                filter: { student, session: session._id },
                update: { $set: { status, notes, arrivedAt: status === 'حاضر' ? new Date() : null } },
                upsert: true
            }
        }));

        await Attendance.bulkWrite(operations);

        const attendanceRecords = await Attendance.find({ session: session._id })
            .populate('student', 'name');

        res.json({
            success: true,
            attendance: attendanceRecords
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/sessions/:id/performance
// @desc    Record performance for session
// @access  Private (Teacher)
router.post('/:id/performance', protect, authorize('teacher', 'director'), async (req, res) => {
    try {
        const { performances } = req.body; // Array of performance records

        const session = await Session.findById(req.params.id);
        if (!session) {
            return res.status(404).json({ message: 'الجلسة غير موجودة' });
        }

        // Upsert performance records
        const operations = performances.map((perf) => ({
            updateOne: {
                filter: { student: perf.student, session: session._id },
                update: { $set: perf },
                upsert: true
            }
        }));

        await Performance.bulkWrite(operations);

        const performanceRecords = await Performance.find({ session: session._id })
            .populate('student', 'name');

        res.json({
            success: true,
            performances: performanceRecords
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
