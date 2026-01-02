const express = require('express');
const Halqa = require('../models/Halqa');
const Student = require('../models/Student');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/dashboard
// @desc    Get dashboard data based on user role
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const isFriday = dayOfWeek === 5;
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // Get Arabic day name
        const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const todayArabic = arabicDays[dayOfWeek];

        // Common data for all roles
        const totalStudents = await Student.countDocuments({ status: 'منتظم' });
        const totalHalqat = await Halqa.countDocuments({ isActive: true });

        // Get today's sessions
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaySessions = await Session.find({
            date: { $gte: today, $lt: tomorrow }
        }).populate({
            path: 'halqa',
            populate: [
                { path: 'teacher', select: 'name' },
                { path: 'classroom', select: 'name' }
            ]
        });

        let dashboardData = {
            today: {
                date: today.toISOString().split('T')[0],
                dayName: todayArabic,
                isFriday,
                isRecreational: isFriday && todaySessions.length > 0 && todaySessions[0].isRecreationalDay,
                time: today.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
            },
            user: {
                _id: req.user._id,
                name: req.user.name,
                role: req.user.role,
                roleDisplay: req.user.getRoleDisplayName()
            }
        };



        // Get Upcoming/Current Friday Status
        let targetFriday = new Date(today);
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        targetFriday.setDate(today.getDate() + daysUntilFriday);
        targetFriday.setHours(0, 0, 0, 0);

        const targetFridayNextDay = new Date(targetFriday);
        targetFridayNextDay.setDate(targetFridayNextDay.getDate() + 1);

        const fridaySessions = await Session.find({
            date: { $gte: targetFriday, $lt: targetFridayNextDay },
            dayType: 'جمعة'
        });

        const isRecreational = fridaySessions.length > 0 && fridaySessions[0].isRecreationalDay;

        dashboardData = {
            ...dashboardData,
            upcomingFriday: {
                date: targetFriday,
                isRecreational,
                isToday: isFriday
            }
        };

        // Role-specific data
        switch (req.user.role) {
            case 'director':
                // Director sees everything
                const subscriptionStats = await Subscription.aggregate([
                    { $match: { year: currentYear, monthNumber: currentMonth } },
                    { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$paidAmount' } } }
                ]);

                let paidIncome = 0;
                let paidCount = 0;
                let pendingCount = 0;

                subscriptionStats.forEach(stat => {
                    if (stat._id === 'مدفوع') {
                        paidIncome = stat.amount;
                        paidCount = stat.count;
                    } else if (stat._id === 'متأخر') {
                        pendingCount = stat.count;
                    }
                });

                dashboardData = {
                    ...dashboardData,
                    stats: {
                        totalStudents,
                        totalHalqat,
                        todaySessionsCount: todaySessions.length,
                        paidSubscriptions: paidCount,
                        pendingSubscriptions: pendingCount,
                        monthlyIncome: paidIncome
                    },
                    sessions: todaySessions,
                    alerts: []
                };

                // Add alerts
                if (pendingCount > 0) {
                    dashboardData.alerts.push({
                        type: 'warning',
                        message: `يوجد ${pendingCount} اشتراك متأخر`
                    });
                }
                break;

            case 'supervisor':
                // Supervisor sees their halqat
                const supervisorHalqat = await Halqa.find({ supervisor: req.user._id, isActive: true })
                    .populate('teacher', 'name')
                    .populate('classroom', 'name');

                const supervisorHalqaIds = supervisorHalqat.map(h => h._id);
                const supervisorStudents = await Student.countDocuments({
                    halqa: { $in: supervisorHalqaIds },
                    status: 'منتظم'
                });

                const supervisorSessions = todaySessions.filter(s =>
                    supervisorHalqaIds.some(id => id.equals(s.halqa._id))
                );

                dashboardData = {
                    ...dashboardData,
                    stats: {
                        totalHalqat: supervisorHalqat.length,
                        totalStudents: supervisorStudents,
                        todaySessionsCount: supervisorSessions.length
                    },
                    halqat: supervisorHalqat,
                    sessions: supervisorSessions
                };
                break;

            case 'teacher':
                // Teacher sees their halqa
                const teacherHalqa = await Halqa.findOne({ teacher: req.user._id, isActive: true })
                    .populate('supervisor', 'name')
                    .populate('classroom', 'name');

                if (teacherHalqa) {
                    const teacherStudents = await Student.find({
                        halqa: teacherHalqa._id,
                        status: 'منتظم'
                    });

                    const teacherSession = todaySessions.find(s =>
                        s.halqa._id.equals(teacherHalqa._id)
                    );

                    dashboardData = {
                        ...dashboardData,
                        halqa: teacherHalqa,
                        students: teacherStudents,
                        session: teacherSession,
                        stats: {
                            totalStudents: teacherStudents.length
                        }
                    };
                }
                break;

            case 'student_affairs':
                // Student affairs sees students and subscriptions
                const recentStudents = await Student.find()
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate('halqa', 'name');

                const pendingSubs = await Subscription.find({
                    year: currentYear,
                    monthNumber: currentMonth,
                    status: 'متأخر'
                }).populate('student', 'name');

                dashboardData = {
                    ...dashboardData,
                    stats: {
                        totalStudents,
                        pendingSubscriptions: pendingSubs.length
                    },
                    recentStudents,
                    pendingSubscriptions: pendingSubs.slice(0, 10)
                };
                break;
        }

        // Add Friday activities info
        if (isFriday) {
            // Check if it's a recreational day based on sessions
            const isRecreational = todaySessions.length > 0 && todaySessions[0].isRecreationalDay;

            dashboardData.fridayInfo = {
                afterFajr: isRecreational ? 'نشاط ترفيهي' : 'نشاط تربوي',
                afterJumaa: 'حلقة تربوية - ابتدائي',
                afterAsr: 'حلقة تربوية - إعدادي',
                afterMaghrib: 'حلقة تربوية - ثانوي وجامعة'
            };
        }

        res.json({
            success: true,
            dashboard: dashboardData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
