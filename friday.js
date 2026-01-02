const express = require('express');
const Session = require('../models/Session');
const Halqa = require('../models/Halqa');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper function to check if today is Friday
const isFriday = (date = new Date()) => {
    return date.getDay() === 5;
};

// Helper function to get next Friday
const getNextFriday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + (daysUntilFriday === 0 ? 0 : daysUntilFriday));
    nextFriday.setHours(0, 0, 0, 0);
    return nextFriday;
};

// @route   GET /api/friday/config
// @desc    Get Friday configuration for the upcoming or current Friday
// @access  Private
router.get('/config', protect, async (req, res) => {
    try {
        const friday = getNextFriday();
        const nextDay = new Date(friday);
        nextDay.setDate(nextDay.getDate() + 1);

        // Find Friday sessions
        const sessions = await Session.find({
            date: { $gte: friday, $lt: nextDay },
            dayType: 'جمعة'
        }).populate('halqa');

        // Check if recreational day is set
        const isRecreational = sessions.length > 0 && sessions[0].isRecreationalDay;
        const recreationalSetAt = sessions.length > 0 ? sessions[0].recreationalDaySetAt : null;

        // Check if it can be modified (must be before the Friday)
        const canModify = !isFriday() || (isFriday() && recreationalSetAt &&
            new Date(recreationalSetAt).toDateString() !== new Date().toDateString());

        res.json({
            success: true,
            config: {
                date: friday,
                isRecreationalDay: isRecreational,
                recreationalDaySetAt: recreationalSetAt,
                canModify: !isFriday() || !recreationalSetAt,
                isTodayFriday: isFriday(),
                sessions: sessions.length
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/friday/recreational
// @desc    Set recreational day for Friday
// @access  Private (director)
router.put('/recreational', protect, authorize('director'), async (req, res) => {
    try {
        const { isRecreational } = req.body;

        // Cannot change on Friday
        if (isFriday()) {
            return res.status(400).json({
                message: 'لا يمكن تغيير إعداد اليوم الترفيهي في نفس يوم الجمعة'
            });
        }

        const friday = getNextFriday();
        const nextDay = new Date(friday);
        nextDay.setDate(nextDay.getDate() + 1);

        // Update or create Friday sessions
        const halqat = await Halqa.find({ isActive: true });

        for (const halqa of halqat) {
            await Session.findOneAndUpdate(
                {
                    halqa: halqa._id,
                    date: { $gte: friday, $lt: nextDay },
                    dayType: 'جمعة'
                },
                {
                    halqa: halqa._id,
                    date: friday,
                    dayType: 'جمعة',
                    isRecreationalDay: isRecreational,
                    recreationalDaySetAt: new Date(),
                    fridayActivity: isRecreational ? 'ترفيهي' : 'تربوي',
                    status: 'لم تبدأ'
                },
                { upsert: true, new: true }
            );
        }

        res.json({
            success: true,
            message: isRecreational ?
                'تم تعيين يوم الجمعة كيوم ترفيهي' :
                'تم تعيين يوم الجمعة كيوم تربوي'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/friday/schedule
// @desc    Get Friday schedule by educational level
// @access  Private
router.get('/schedule', protect, async (req, res) => {
    try {
        const friday = getNextFriday();

        // Fixed Friday educational sessions schedule
        const schedule = {
            date: friday,
            isTodayFriday: isFriday(),
            sessions: [
                {
                    time: 'بعد الفجر',
                    type: 'ترفيهي/تربوي',
                    description: 'نشاط ترفيهي أو تربوي حسب الإعداد'
                },
                {
                    time: 'بعد الجمعة',
                    level: 'ابتدائي',
                    description: 'جلسة المرحلة الابتدائية'
                },
                {
                    time: 'بعد العصر',
                    level: 'إعدادي',
                    description: 'جلسة المرحلة الإعدادية'
                },
                {
                    time: 'بعد المغرب',
                    level: 'ثانوي / جامعة',
                    description: 'جلسة المرحلة الثانوية والجامعة'
                }
            ]
        };

        // Get actual Friday sessions
        const nextDay = new Date(friday);
        nextDay.setDate(nextDay.getDate() + 1);

        const actualSessions = await Session.find({
            date: { $gte: friday, $lt: nextDay },
            dayType: 'جمعة'
        }).populate('halqa');

        const isRecreational = actualSessions.length > 0 && actualSessions[0].isRecreationalDay;

        // Sessions are fixed, recreational status is additive
        // We do not overwrite the schedule based on isRecreational


        res.json({
            success: true,
            schedule,
            isRecreationalDay: isRecreational
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/friday/generate-sessions
// @desc    Generate Friday sessions for all halqat
// @access  Private (director)
router.post('/generate-sessions', protect, authorize('director'), async (req, res) => {
    try {
        const friday = getNextFriday();
        const nextDay = new Date(friday);
        nextDay.setDate(nextDay.getDate() + 1);

        const halqat = await Halqa.find({ isActive: true });
        const createdSessions = [];

        for (const halqa of halqat) {
            // Check if session already exists
            const existing = await Session.findOne({
                halqa: halqa._id,
                date: { $gte: friday, $lt: nextDay }
            });

            if (!existing) {
                const session = await Session.create({
                    halqa: halqa._id,
                    date: friday,
                    dayType: 'جمعة',
                    teacher: halqa.teacher,
                    supervisor: halqa.supervisor,
                    classroom: halqa.classroom,
                    status: 'لم تبدأ'
                });
                createdSessions.push(session);
            }
        }

        res.json({
            success: true,
            message: `تم إنشاء ${createdSessions.length} جلسة ليوم الجمعة`,
            sessionsCreated: createdSessions.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
